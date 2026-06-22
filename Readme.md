# Domain List Aggregator

*Created for educational purposes only.*

This project aggregates domain names, IP addresses, and CIDR prefixes from several public sources and generates structured output files for filtering, allowlists, network inventory, and analysis.

Supported output formats: plain `.lst`, mihomo `.mrs`, sing-box `.srs`.

Data sources:

- https://iplist.opencck.org (main, beta, russia)
- https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo/geosite
- https://github.com/v2fly/domain-list-community
- https://stat.ripe.net (BGP announced prefixes by ASN)

## Setup

1. Fork this repository.
2. Adjust the workflow schedule in `.github/workflows/generate.yml` to match your preferred execution time.
3. In the repository settings, create a secret named `CONFIG_CONTENT` and paste the application configuration there.

The workflow reads this configuration and generates list files automatically.  
Generated files are stored under each output provider's `outputDir`; `.generated_files` in that directory lists all managed filenames.

Local run:

```bash
npm install
CONFIG_PATH=./sample-config.json node index.js
```

## Configuration files

See `sample-config.json` for a minimal example. Specify only **non-default** parameters in JSON; defaults live in `config/loadConfig.js`.

Example (minimal):

```json
{
  "sections": [
    {
      "name": "proxy-domains",
      "recordTypes": ["domain"],
      "dataProviders": ["opencck-main", "metacube", "v2fly"],
      "groups": ["youtube", "games", "tools"],
      "services": ["telegram", "discord", "github"],
      "outputProviders": [
        {
          "id": "text",
          "outputDir": "lists/proxy",
          "outputLayout": { "domain": "domains" },
          "generateCombinedFiles": true,
          "domainTemplate": "{{record}} #{{service}}\n"
        }
      ]
    }
  ]
}
```

Parallel text + ruleset output (multiple `outputProviders` in one section):

```text
data/raw/domains/proxy/discord.lst
data/mihomo/domains/proxy/discord.mrs
data/mihomo/domains/proxy/.source/discord.txt
data/sing-box/domains/proxy/discord.srs
```

Each section should use **separate** `outputDir` values when filenames may collide.

### Data providers

| ID | Description |
|----|-------------|
| `opencck-main` | iplist.opencck.org — groups, domains, IP, CIDR |
| `opencck-beta` | beta.iplist.opencck.org |
| `opencck-russia` | russia.iplist.opencck.org |
| `metacube` | MetaCubeX geosite JSON (domains) |
| `v2fly` | v2fly domain-list-community (domains) |
| `bgpAsn` | RIPE Stat announced prefixes for `AS{number}` services |

For BGP, add services like `"AS15169"` or `"AS13335"` and include `cidr4` / `cidr6` in `recordTypes`.

### Output providers

| ID | Description |
|----|-------------|
| `text` | Plain `.lst` files with templates and layout |
| `mihomo` | `.txt` → `.mrs` via `mihomo convert-ruleset` |
| `singbox` | `.json` → `.srs` via `sing-box rule-set compile` |

All three support the same file grouping: per-service, per-group, `_all_in_one`, partitions (`maxFileEntries`).

## Configuration parameters

### Root

| Parameter | Default | Description |
|-----------|---------|-------------|
| `sections` | — | List of generation sections (required) |
| `rawTempDir` | see `loadConfig.js` | Intermediate raw data between runs |
| `keepRaw` | `false` | Do not delete raw cache after run |
| `useRawCache` | `false` | Reuse existing raw per section; also via `USE_RAW_CACHE=1` |

`keepRaw` is **root-only**. There is no per-section `keepRaw`.

When `useRawCache` is enabled, raw data is also kept after run (no re-download if `.raw_manifest` exists).

### Section (data collection)

| Parameter | Description |
|-----------|-------------|
| `name` | Section label (logging) |
| `recordTypes` | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `dataProviders` | Data provider IDs (required) |
| `groups` | opencck groups; expands `services` |
| `services` | Service names or ASN identifiers |
| `additionalLists` | External URLs; key becomes `_key` service |
| `collapseCidrs` | Merge overlapping/adjacent CIDR on raw layer |

### Output provider (shared)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `outputDir` | `./lists` | Root output directory |
| `outputLayout` | `{ "domain": "." }` | Subfolder per record type |
| `generateIndividualFiles` | `true` | One file per service |
| `generateGroupFiles` | `false` | One file per opencck group |
| `generateCombinedFiles` | `false` | Combined `_all_in_one` |
| `maxFileEntries` | `-1` | Max entries per file; partitions if `>0` |

### Output provider (`text`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fileExtension` | `lst` | Output extension |
| `domainTemplate` | `{{record}}\n` | Line template (`{{domain}}` = alias) |
| `perServiceTemplate` | `""` | Header before each service block in combined/group files |

### Output provider (`mihomo`)

Requires `mihomo` in PATH. Domains include subdomains by default (`+.{{record}}`).

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fileExtension` | `mrs` | Compiled output |
| `sourceExtension` | `txt` | Intermediate source |
| `sourceLayout` | same as `outputLayout` | Subfolder for source files |
| `keepSourceFiles` | `false` | Keep `.txt` after compile |
| `requireCompiler` | `true` | Fail if `mihomo` unavailable |

Decompile `.mrs` back to text is **not supported** — use `keepSourceFiles` or `data/.../.source/`.

### Output provider (`singbox`)

Requires `sing-box` in PATH.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `fileExtension` | `srs` | Compiled output |
| `sourceExtension` | `json` | Intermediate source |
| `keepSourceFiles` | `false` | Keep `.json` after compile |
| `domainIncludeSubdomains` | `true` | `domain` + `domain_suffix` |
| `rulesetVersion` | `3` | sing-box source format version |

Decompile: `sing-box rule-set decompile -o out.json file.srs`

### additionalLists formats

```json
"additionalLists": {
  "custom-list": ["https://example.com/domains.txt"],
  "extra-cidr": {
    "type": "cidr4",
    "urls": ["https://example.com/prefixes.txt"]
  }
}
```

---

# Агрегатор списков доменов

*Создан сугубо в образовательных целях.*

Проект агрегирует домены, IP-адреса и CIDR-префиксы из публичных источников и генерирует `.lst`, `.mrs` (mihomo), `.srs` (sing-box).

## Настройка

1. Сделайте форк репозитория.
2. Измените расписание в `.github/workflows/generate.yml`.
3. Создайте секрет `CONFIG_CONTENT` с конфигурацией приложения.

Локальный запуск:

```bash
npm install
CONFIG_PATH=./sample-config.json node index.js
```

## Конфигурационные файлы

Пример — `sample-config.json`. В JSON указывайте только параметры, **отличающиеся от defaults** (`config/loadConfig.js`).

### Output providers

| ID | Описание |
|----|----------|
| `text` | Plain `.lst` |
| `mihomo` | `.txt` → `.mrs` (`mihomo convert-ruleset`) |
| `singbox` | `.json` → `.srs` (`sing-box rule-set compile`) |

### Параметры корня

| Параметр | Default | Описание |
|----------|---------|----------|
| `rawTempDir` | см. `loadConfig.js` | Raw-кэш между run |
| `keepRaw` | `false` | Не удалять raw после run |
| `useRawCache` | `false` | Переиспользовать raw секций; env `USE_RAW_CACHE=1` |

**`keepRaw` только на корне конфига.** Per-section `keepRaw` не поддерживается.

При `useRawCache: true` raw также сохраняется после run.

### Output provider (`mihomo` / `singbox`)

Общие с `text`: `outputDir`, `outputLayout`, `generateIndividualFiles`, `generateGroupFiles`, `generateCombinedFiles`, `maxFileEntries`.

Дополнительно: `sourceLayout`, `keepSourceFiles` (промежуточные `.txt` / `.json` в `.source/`).

Декомпиляция: `.srs` → `sing-box rule-set decompile`; `.mrs` — только через сохранённый source.

## Пример вывода

```text
jetbrains.com
telegram.org
```

CIDR (`cidr4/AS15169.lst`):

```text
142.250.0.0/15
172.217.0.0/16
```

Mihomo source (`.source/discord.txt`):

```text
+.discord.com
+.discord.gg
```
