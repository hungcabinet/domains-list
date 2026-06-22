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
3. In the repository settings, create secrets:
   - `CONFIG_CONTENT` — application configuration (JSON)
   - `GIT_COMMIT_PATHS` (optional) — what to stage after generation: `*` for all changes, or comma-separated paths (default: `*`)

The workflow reads the configuration and generates list files automatically.  
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
| `additionalLists` | Custom lists (URL, local file, inline); key becomes `_key` service |
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

Each key becomes a service named `_key`. Sources can be combined in one entry.

**URL only** (shorthand — array of URLs):

```json
"additionalLists": {
  "custom-list": ["https://example.com/domains.txt"]
}
```

**Object** — `urls`, `files`, and/or `entries` (inline addresses, no download):

```json
"additionalLists": {
  "extra-cidr": {
    "type": "cidr4",
    "urls": ["https://example.com/prefixes.txt"]
  },
  "local-domains": {
    "files": ["./custom/my-domains.lst"]
  },
  "inline-domains": {
    "entries": ["example.com", "cdn.example.com"]
  },
  "mixed": {
    "type": "domain",
    "urls": ["https://example.com/domains.txt"],
    "files": ["./custom/extra.lst"],
    "entries": ["one-off.example.com"]
  }
}
```

- `files` — path relative to the config file, or absolute
- `file` — single file (alias for one-element `files`)
- `entries` / `items` / `addresses` — inline list of records
- `type` — record type (`domain` by default): `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6`

---

# Агрегатор списков доменов

*Создан сугубо в образовательных целях.*

Проект агрегирует домены, IP-адреса и CIDR-префиксы из нескольких публичных источников и генерирует структурированные файлы для фильтрации, allowlist, сетевой инвентаризации и анализа.

Поддерживаемые форматы вывода: plain `.lst`, mihomo `.mrs`, sing-box `.srs`.

Источники данных:

- https://iplist.opencck.org (main, beta, russia)
- https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo/geosite
- https://github.com/v2fly/domain-list-community
- https://stat.ripe.net (BGP announced prefixes by ASN)

## Настройка

1. Сделайте форк репозитория.
2. Настройте расписание workflow в `.github/workflows/generate.yml` под удобное время запуска.
3. Создайте секреты в настройках репозитория:
   - `CONFIG_CONTENT` — конфигурация приложения (JSON)
   - `GIT_COMMIT_PATHS` (необязательно) — что добавлять в commit после генерации: `*` — все изменения, или пути через запятую (по умолчанию: `*`)

Workflow читает конфигурацию и автоматически генерирует файлы списков.  
Сгенерированные файлы сохраняются в `outputDir` каждого output provider; `.generated_files` в этой директории перечисляет все управляемые имена файлов.

Локальный запуск:

```bash
npm install
CONFIG_PATH=./sample-config.json node index.js
```

## Конфигурационные файлы

Минимальный пример — `sample-config.json`. В JSON указывайте только параметры, **отличающиеся от значений по умолчанию**; defaults находятся в `config/loadConfig.js`.

Пример (минимальный):

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

Параллельный вывод text + ruleset (несколько `outputProviders` в одной секции):

```text
data/raw/domains/proxy/discord.lst
data/mihomo/domains/proxy/discord.mrs
data/mihomo/domains/proxy/.source/discord.txt
data/sing-box/domains/proxy/discord.srs
```

Если имена файлов могут пересекаться, в каждой секции используйте **разные** значения `outputDir`.

### Data providers

| ID | Описание |
|----|----------|
| `opencck-main` | iplist.opencck.org — groups, domains, IP, CIDR |
| `opencck-beta` | beta.iplist.opencck.org |
| `opencck-russia` | russia.iplist.opencck.org |
| `metacube` | MetaCubeX geosite JSON (domains) |
| `v2fly` | v2fly domain-list-community (domains) |
| `bgpAsn` | RIPE Stat announced prefixes для сервисов `AS{number}` |

Для BGP добавьте сервисы вида `"AS15169"` или `"AS13335"` и включите `cidr4` / `cidr6` в `recordTypes`.

### Output providers

| ID | Описание |
|----|----------|
| `text` | Plain `.lst` с шаблонами и layout |
| `mihomo` | `.txt` → `.mrs` через `mihomo convert-ruleset` |
| `singbox` | `.json` → `.srs` через `sing-box rule-set compile` |

Все три поддерживают одинаковую группировку файлов: по сервису, по группе, `_all_in_one`, разбиение (`maxFileEntries`).

## Параметры конфигурации

### Корень

| Параметр | Default | Описание |
|----------|---------|----------|
| `sections` | — | Список секций генерации (обязательно) |
| `rawTempDir` | см. `loadConfig.js` | Промежуточные raw-данные между запусками |
| `keepRaw` | `false` | Не удалять raw-кэш после запуска |
| `useRawCache` | `false` | Переиспользовать существующий raw по секциям; также через `USE_RAW_CACHE=1` |

`keepRaw` задаётся **только на корне**. Per-section `keepRaw` не поддерживается.

При включённом `useRawCache` raw-данные также сохраняются после запуска (без повторной загрузки, если есть `.raw_manifest`).

### Секция (сбор данных)

| Параметр | Описание |
|----------|----------|
| `name` | Метка секции (логирование) |
| `recordTypes` | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `dataProviders` | ID data providers (обязательно) |
| `groups` | группы opencck; расширяют `services` |
| `services` | имена сервисов или идентификаторы ASN |
| `additionalLists` | пользовательские списки (URL, локальный файл, inline); ключ становится сервисом `_key` |
| `collapseCidrs` | объединение перекрывающихся/смежных CIDR на raw-слое |

### Output provider (общие)

| Параметр | Default | Описание |
|----------|---------|----------|
| `outputDir` | `./lists` | Корневая директория вывода |
| `outputLayout` | `{ "domain": "." }` | Подпапка для каждого типа записей |
| `generateIndividualFiles` | `true` | Один файл на сервис |
| `generateGroupFiles` | `false` | Один файл на группу opencck |
| `generateCombinedFiles` | `false` | Объединённый `_all_in_one` |
| `maxFileEntries` | `-1` | Макс. записей в файле; разбиение при `>0` |

### Output provider (`text`)

| Параметр | Default | Описание |
|----------|---------|----------|
| `fileExtension` | `lst` | Расширение выходных файлов |
| `domainTemplate` | `{{record}}\n` | Шаблон строки (`{{domain}}` — alias) |
| `perServiceTemplate` | `""` | Заголовок перед блоком сервиса в combined/group файлах |

### Output provider (`mihomo`)

Требуется `mihomo` в PATH. Домены по умолчанию включают поддомены (`+.{{record}}`).

| Параметр | Default | Описание |
|----------|---------|----------|
| `fileExtension` | `mrs` | Скомпилированный вывод |
| `sourceExtension` | `txt` | Промежуточный source |
| `sourceLayout` | как `outputLayout` | Подпапка для source-файлов |
| `keepSourceFiles` | `false` | Сохранять `.txt` после компиляции |
| `requireCompiler` | `true` | Ошибка, если `mihomo` недоступен |

Декомпиляция `.mrs` обратно в текст **не поддерживается** — используйте `keepSourceFiles` или `data/.../.source/`.

### Output provider (`singbox`)

Требуется `sing-box` в PATH.

| Параметр | Default | Описание |
|----------|---------|----------|
| `fileExtension` | `srs` | Скомпилированный вывод |
| `sourceExtension` | `json` | Промежуточный source |
| `keepSourceFiles` | `false` | Сохранять `.json` после компиляции |
| `domainIncludeSubdomains` | `true` | `domain` + `domain_suffix` |
| `rulesetVersion` | `3` | Версия формата source sing-box |

Декомпиляция: `sing-box rule-set decompile -o out.json file.srs`

### Форматы additionalLists

Каждый ключ становится сервисом с именем `_key`. Источники можно комбинировать в одной записи.

**Только URL** (сокращённая форма — массив URL):

```json
"additionalLists": {
  "custom-list": ["https://example.com/domains.txt"]
}
```

**Объект** — `urls`, `files` и/или `entries` (inline-адреса, без загрузки):

```json
"additionalLists": {
  "extra-cidr": {
    "type": "cidr4",
    "urls": ["https://example.com/prefixes.txt"]
  },
  "local-domains": {
    "files": ["./custom/my-domains.lst"]
  },
  "inline-domains": {
    "entries": ["example.com", "cdn.example.com"]
  },
  "mixed": {
    "type": "domain",
    "urls": ["https://example.com/domains.txt"],
    "files": ["./custom/extra.lst"],
    "entries": ["one-off.example.com"]
  }
}
```

- `files` — путь относительно файла конфигурации или абсолютный
- `file` — один файл (alias для `files` из одного элемента)
- `entries` / `items` / `addresses` — inline-список записей
- `type` — тип записи (`domain` по умолчанию): `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6`
