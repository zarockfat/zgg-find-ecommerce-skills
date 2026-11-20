"""Merge explicitly curated sources; never execute a candidate skill.

Run collect.py first. Maintenance dependency: PyYAML (not needed by website).
"""
import collections
import hashlib
import json
import pathlib
import re
from urllib.parse import quote

import yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read(name):
    return json.loads((ROOT / name).read_text())


def write(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def inspect(repo, candidate):
    path = pathlib.PurePosixPath(candidate['path'])
    if '..' in path.parts or path.is_absolute():
        return None, 'invalid-path'
    if repo['license'] == 'UNKNOWN':
        return None, 'license-unconfirmed'
    if any(part.lower() in {'deprecated', 'archive', 'archived'} for part in path.parts):
        return None, 'archived-path'
    if path.name != 'SKILL.md':
        return None, 'filename-compatibility-unconfirmed'
    local = ROOT / '.cache/repository-snapshots' / repo['repo'].replace('/', '--') / repo['source_commit'] / path
    raw = local.read_bytes()
    if hashlib.sha256(raw).hexdigest() != candidate['content_sha256']:
        return None, 'hash-mismatch'
    m = re.match(r'^---\s*\n(.*?)\n---', raw.decode('utf-8-sig'), re.S)
    try:
        meta = yaml.safe_load(m[1]) if m else None
    except yaml.YAMLError:
        return None, 'invalid-metadata'
    if not isinstance(meta, dict) or not isinstance(meta.get('name'), str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', meta['name']) or len(meta['name']) > 64 or not isinstance(meta.get('description'), str) or not meta['description'].strip():
        return None, 'invalid-metadata'
    return meta, None


def refresh_reviewed(rows, repos, reviews):
    """Refresh only exact snapshots explicitly reviewed by a maintainer."""
    by_source = {(s['repo'], s['path']): s for s in rows}
    refreshed, rejected = [], []
    for review in reviews:
        key = (review['repo'], review['path'])
        row, repo = by_source.get(key), repos.get(review['repo'])
        source = next((c for c in (repo or {}).get('candidates', []) if c['path'] == review['path']), None)
        if not row or not source or any(source.get(k) != review.get(k) for k in ['source_commit', 'content_sha256']):
            rejected.append(dict(repo=key[0], path=key[1], reason='review-snapshot-mismatch'))
            continue
        meta, error = inspect(repo, source)
        if not error and meta['name'] != row['name']:
            error = 'review-name-changed'
        if not error and any(s is not row and s['content_sha256'] == source['content_sha256'] for s in rows):
            error = 'duplicate-content'
        if error:
            rejected.append(dict(repo=key[0], path=key[1], reason=error))
            continue
        license_paths = [p for p, v in repo['licenses'].items() if v == repo['license']]
        license_path = min(license_paths, key=lambda p: (p.count('/'), len(p)))
        changed = review.get('previous_content_sha256', row['content_sha256']) != source['content_sha256']
        row.update(source_commit=source['source_commit'], content_sha256=source['content_sha256'],
                   source_url=source['source_url'], license=repo['license'],
                   license_url=f"https://github.com/{repo['repo']}/blob/{repo['source_commit']}/{quote(license_path)}",
                   checked_at=review['reviewed_at'])
        refreshed.append(dict(id=row['id'], repo=key[0], path=key[1], content_changed=changed))
    return refreshed, rejected


def main():
    report, curated, catalog = read('data/collection-report.json'), read('data/curation.json'), read('data/catalog.json')
    decisions_file = ROOT / 'data/review-decisions.json'
    decisions = {(x['repo'], x['path']): x for x in (read('data/review-decisions.json')['items'] if decisions_file.exists() else [])}
    rows = catalog['skills']
    by_source = {(s['repo'], s['path']): s for s in rows}
    hashes = {s['content_sha256'] for s in rows}
    ids = {s['id'] for s in rows}
    repos = {r['repo']: r for r in report['repositories']}
    # Explicit reviews are bound to the exact commit and every evidence file hash.
    # They supplement the deliberately conservative automatic license recognizer.
    license_review_file = ROOT / 'data/license-reviews.json'
    license_reviews = read('data/license-reviews.json')['items'] if license_review_file.exists() else []
    for review in license_reviews:
        repo = repos.get(review['repo'])
        if not repo or repo.get('source_commit') != review['source_commit']:
            continue
        for evidence in review['evidence']:
            path = pathlib.PurePosixPath(evidence['path'])
            assert not path.is_absolute() and '..' not in path.parts
            local = ROOT / '.cache/repository-snapshots' / repo['repo'].replace('/', '--') / repo['source_commit'] / path
            assert hashlib.sha256(local.read_bytes()).hexdigest() == evidence['sha256'], 'License evidence changed'
        assert review['license_path'] in {e['path'] for e in review['evidence']}
        repo['license'] = review['license']
        repo['licenses'][review['license_path']] = review['license']
        repo['license_review'] = review
    update_file = ROOT / 'data/source-update-reviews.json'
    update_reviews = read('data/source-update-reviews.json')['items'] if update_file.exists() else []
    refreshed, refresh_rejections = refresh_reviewed(rows, repos, update_reviews)
    hashes = {s['content_sha256'] for s in rows}
    rejected = []
    for choice in curated['items']:
        key = (choice['repo'], choice['path'])
        if key in by_source:
            continue  # Preserve published, pinned records and favorite IDs.
        if key in decisions:
            rejected.append(decisions[key])
            continue
        repo = repos[choice['repo']]
        source = next((c for c in repo.get('candidates', []) if c['path'] == choice['path']), None)
        meta, error = inspect(repo, source) if source else (None, 'missing-source')
        if not error and any(k in choice and choice[k] != source[k] for k in ['source_commit', 'content_sha256']):
            error = 'review-snapshot-mismatch'
        if not error and source['content_sha256'] in hashes:
            error = 'duplicate-content'
        ident = choice['repo'].split('/')[0] + '--' + (meta or {}).get('name', '')
        if not error and ident in ids:
            error = 'duplicate-id'
        if error:
            rejected.append(dict(repo=choice['repo'], path=choice['path'], reason=error))
            continue
        license_paths = [p for p, v in repo['licenses'].items() if v == repo['license']]
        license_path = min(license_paths, key=lambda p: (p.count('/'), len(p)))
        record = dict(choice, id=ident, name=meta['name'], author=choice['repo'].split('/')[0],
                      license=repo['license'], license_url=f"https://github.com/{repo['repo']}/blob/{repo['source_commit']}/{quote(license_path)}",
                      source_url=source['source_url'], repo_url=repo['repo_url'], source_commit=repo['source_commit'],
                      content_sha256=source['content_sha256'], checked_at=choice.get('reviewed_at', curated['reviewed_at']), verification='source-checked',
                      tested=False, compatibility='包含 SKILL.md；需配置原文依赖，未逐客户端实测',
                      limitations='仅核对公开文档、名称、许可证与依赖说明；未验证安装、接口返回或实际业务效果。开源 Skill 不等于其依赖服务免费。',
                      review_basis='用途与依赖说明人工分类；文件哈希与元信息校验',
                      tags=list(dict.fromkeys(choice['platforms'] + [choice['category'], choice['capability']])), featured=False)
        if meta.get('compatibility'):
            record['requirements'].append(str(meta['compatibility']))
        rows.append(record)
        by_source[key] = record
        hashes.add(record['content_sha256'])
        ids.add(ident)

    # Mutually exclusive dispositions describe this scan, not every published version.
    dispositions = collections.Counter()
    seen = set()
    for repo in report['repositories']:
        for source in repo.get('candidates', []):
            key = (repo['repo'], source['path'])
            if key in by_source:
                state = 'published-path'
            elif key in decisions:
                state = decisions[key]['disposition']
            else:
                _, error = inspect(repo, source)
                state = error or ('duplicate-content' if source['content_sha256'] in seen else 'pending-relevance-review')
            seen.add(source['content_sha256'])
            dispositions[state] += 1
    summary = dict(collected_at=report['collected_at'], scope_complete=False, method=report['method'],
                   repositories_attempted=len(repos), repositories_scanned=sum(r['status'] == 'scanned' for r in repos.values()),
                   raw_candidate_files=sum(dispositions.values()), candidate_dispositions=dict(dispositions),
                   published_skills=len(rows), published_repositories=len({s['repo'] for s in rows}),
                   published_platforms=sorted({p for s in rows for p in s['platforms']}),
                   capability_counts=dict(collections.Counter(s['capability'] for s in rows)),
                   tested_skills=sum(s['tested'] for s in rows), selected_rejections=rejected,
                   refreshed_sources=refreshed, refresh_rejections=refresh_rejections,
                   manual_decisions=list(decisions.values()),
                   incremental=report.get('incremental', False),
                   newly_scanned_repositories=report.get('newly_scanned_repositories', []),
                   limitations=report['limitations'] + ['published-path 表示同路径已收录，发布版本可能早于本轮扫描；其余候选尚未完成电商相关性审核。'],
                   repositories=[{k: v for k, v in r.items() if k not in {'candidates', 'licenses'}} for r in repos.values()])
    catalog.update(updated_at=curated['reviewed_at'], coverage='公开仓库精选目录，未覆盖全网；来源核对不等于安装或业务实测', collection=summary)
    write('data/catalog.json', catalog)
    write('data/review-summary.json', summary)
    labels = {'invalid-metadata':'元信息不满足规则', 'pending-relevance-review':'待相关性审核',
              'published-path':'路径已收录（版本可能不同）', 'license-unconfirmed':'许可证待核实',
              'filename-compatibility-unconfirmed':'文件名兼容性待核实', 'archived-path':'废弃目录',
              'duplicate-content':'重复内容', 'outdated-reference':'参考费率或规则过时',
              'insufficient-instructions':'操作说明不足', 'consumer-shopping-scope':'买家购物用途暂缓收录',
              'implementation-pending':'原文标记待实现'}
    lines = ['# 电商技能库 · 采集报告', '', f"报告时间：{summary['collected_at']}", '',
             f"累计检查 {summary['repositories_attempted']} 个仓库，成功扫描 {summary['repositories_scanned']} 个，发现 {summary['raw_candidate_files']:,} 个候选文件。发布目录：**{len(rows)} 个 Skill / {summary['published_repositories']} 个仓库**。", '',
             '候选包含通用工具、重复和不符合条件的内容，不等于电商技能数量；不代表全网覆盖。增量扫描保留已有仓库的原核对时间，不表示本轮重新抓取全部仓库。', '',
             f"本轮新增扫描：{len(summary['newly_scanned_repositories'])} 个仓库。安装与业务均未实测。", '',
             '## 候选处理统计', '', '| 状态 | 数量 |', '| --- | ---: |']
    lines += [f'| {labels.get(k,k)} | {v} |' for k,v in dispositions.items()]
    lines += ['', '统计互斥；已发布路径保留原核对版本。其余待审条目尚未完成电商相关性、安装与业务审核。', '', '## 本轮人工暂缓', '']
    lines += [f"- `{x['repo']}/{x['path']}`：{x['reason']}" for x in decisions.values()]
    lines += ['', '## 仓库来源', '', '| 仓库 | 扫描状态 | 候选数 | 许可证识别 |', '| --- | --- | ---: | --- |']
    lines += [f"| [{r['repo']}]({r['repo_url']}) | {r['status']} | {r.get('candidate_count',0)} | {r.get('license','UNKNOWN')} |" for r in repos.values()]
    lines += ['', '## 未完成扫描', '']
    lines += [f"- {r['repo']}：{r.get('error','未完成')}" for r in repos.values() if r['status'] != 'scanned']
    lines += ['', '## 能力与依赖', ''] + [f'- {k}：{v} 个。' for k,v in summary['capability_counts'].items()]
    lines += ['', '开源许可证只覆盖对应 Skill，账号授权、连接器、API 或生成服务仍需按原文配置和计费。目录核对不等于安装或业务效果已验证。网页与 AI 导航使用同一目录；未设置自动审核发布或定时采集。']
    (ROOT / 'data/collection-summary.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({k: v for k, v in summary.items() if k not in {'repositories', 'limitations', 'published_platforms', 'refreshed_sources'}}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
