# Domain List Aggregator

*Created for educational purposes only.*

This project aggregates domain names, IP addresses, and CIDR prefixes from several public sources and generates structured output files for filtering, allowlists, network inventory, and analysis.

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
echo 'CONFIG_PATH=./sample-config.json' > .env
npm install
node index.js
```

## Configuration

See `sample-config.json` for a full example.

```json
{
  "rawTempDir": ".cache/raw",
  "keepRaw": false,
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
          "generateIndividualFiles": true,
          "generateCombinedFiles": true,
          "domainTemplate": "{{record}} #{{service}}\n"
        }
      ]
    }
  ]
}
```

Multiple sections should use **separate** `outputDir` values. Output files are named by service, group, or `_all_in_one`; if two sections share a directory, later sections overwrite earlier ones with the same filename (for example `_all_in_one.lst`, `telegram.lst`, or a shared group name).

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

## Configuration Parameters

### Root

| Parameter | Type | Description |
|-----------|------|-------------|
| `sections` | array | List of generation sections (required) |
| `rawTempDir` | string | Intermediate raw data directory (default `.cache/raw`) |
| `keepRaw` | boolean | Keep raw data after run for inspection (default `false`) |
| `useRawCache` | boolean | Reuse existing raw cache per section; skip network when `.raw_manifest` is present (default `false`). Also via env `USE_RAW_CACHE=1` |

### Section (data collection)

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Section label (logging) |
| `recordTypes` | array | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `dataProviders` | array | Data provider IDs (required) |
| `groups` | array | opencck groups; expands `services` |
| `services` | array | Service names or ASN identifiers |
| `additionalLists` | object | External URLs; key becomes `_key` service |
| `collapseCidrs` | boolean | Merge overlapping/adjacent CIDR on raw layer |
| `collapseCidr4` | boolean | Merge IPv4 CIDR only |
| `collapseCidr6` | boolean | Merge IPv6 CIDR only |

### Output provider (`text`)

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Output provider ID (`text`) |
| `outputDir` | string | Root output directory |
| `outputLayout` | object | Subfolder per record type, e.g. `{ "domain": "domains" }` |
| `generateIndividualFiles` | boolean | One file per service |
| `generateCombinedFiles` | boolean | Combined `_all_in_one.lst` |
| `maxFileEntries` | integer | Max entries per file; `-1` = no limit |
| `domainTemplate` | string | Template for domain lines (`{{record}}`, `{{service}}`) |
| `cidr4Template` | string | Template for IPv4 CIDR lines |
| `perServiceTemplate` | string | Header inserted before each service block |
| `fileExtension` | string | Output file extension (default `lst`) |

### additionalLists formats

Simple (domains):

```json
"additionalLists": {
  "custom-list": ["https://example.com/domains.txt"]
}
```

With record type:

```json
"additionalLists": {
  "extra-cidr": {
    "type": "cidr4",
    "urls": ["https://example.com/prefixes.txt"]
  }
}
```

## Example Output

```text
#service1
api.service1.com #service1
users.service1.com #service1
service1.com #service1

#service2
api.service2.com #service2
service2.com #service2
```

CIDR example (`cidr4/AS15169.lst`):

```text
142.250.0.0/15
172.217.0.0/16
```

---

# Агрегатор списков доменов

*Создан сугубо в образовательных целях.*

Проект агрегирует домены, IP-адреса и CIDR-префиксы из публичных источников и генерирует структурированные файлы для фильтрации, allowlist-ов, инвентаризации сетей и анализа.

Источники данных:

- https://iplist.opencck.org (main, beta, russia)
- https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo/geosite
- https://github.com/v2fly/domain-list-community
- https://stat.ripe.net (BGP-префиксы по ASN)

## Настройка

1. Сделайте форк репозитория.
2. Измените расписание в `.github/workflows/generate.yml`.
3. Создайте секрет `CONFIG_CONTENT` с конфигурацией приложения.

Workflow генерирует файлы по конфигурации.  
Результаты лежат в `outputProviders[].outputDir`; `.generated_files` — индекс управляемых файлов.

Локальный запуск:

```bash
echo 'CONFIG_PATH=./sample-config.json' > .env
npm install
node index.js
```

## Конфигурация

Полный пример — `sample-config.json`.

```json
{
  "rawTempDir": ".cache/raw",
  "keepRaw": false,
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
          "generateIndividualFiles": true,
          "generateCombinedFiles": true,
          "domainTemplate": "{{record}} #{{service}}\n"
        }
      ]
    }
  ]
}
```

У каждой секции должен быть **свой** `outputDir`. Файлы именуются по сервису, группе или как `_all_in_one`; при общей папке более поздняя секция перезаписывает файлы предыдущей с тем же именем (например `_all_in_one.lst`, `telegram.lst` или общая группа вроде `tools`).

### Data providers

| ID | Описание |
|----|----------|
| `opencck-main` | iplist.opencck.org — группы, домены, IP, CIDR |
| `opencck-beta` | beta.iplist.opencck.org |
| `opencck-russia` | russia.iplist.opencck.org |
| `metacube` | MetaCubeX geosite JSON (домены) |
| `v2fly` | v2fly domain-list-community (домены) |
| `bgpAsn` | RIPE Stat, префиксы для сервисов `AS{номер}` |

### Output providers

| ID | Описание |
|----|----------|
| `text` | Plain `.lst` с шаблонами и layout |

## Параметры конфигурации

### Корень

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sections` | array | Список секций (обязательно) |
| `rawTempDir` | string | Промежуточные raw-данные (по умолчанию `.cache/raw`) |
| `keepRaw` | boolean | Не удалять raw после run (по умолчанию `false`) |
| `useRawCache` | boolean | Использовать raw-кэш секции без скачивания, если есть `.raw_manifest` (по умолчанию `false`). Также env `USE_RAW_CACHE=1` |

### Секция (сбор данных)

| Параметр | Тип | Описание |
|----------|-----|----------|
| `name` | string | Имя секции (логи) |
| `recordTypes` | array | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `dataProviders` | array | ID провайдеров данных (обязательно) |
| `groups` | array | Группы opencck; расширяют `services` |
| `services` | array | Имена сервисов или ASN |
| `additionalLists` | object | Внешние URL; ключ → сервис `_key` |
| `collapseCidrs` | boolean | Склейка CIDR на raw-слое |
| `collapseCidr4` | boolean | Только IPv4 CIDR |
| `collapseCidr6` | boolean | Только IPv6 CIDR |

### Output provider (`text`)

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | string | ID провайдера вывода (`text`) |
| `outputDir` | string | Корневая папка вывода |
| `outputLayout` | object | Подпапка на тип записи |
| `generateIndividualFiles` | boolean | Отдельный файл на сервис |
| `generateCombinedFiles` | boolean | Общий `_all_in_one.lst` |
| `maxFileEntries` | integer | Лимит записей на файл; `-1` = без лимита |
| `domainTemplate` | string | Шаблон строки домена |
| `cidr4Template` | string | Шаблон строки CIDR |
| `perServiceTemplate` | string | Заголовок перед блоком сервиса |
| `fileExtension` | string | Расширение файлов (по умолчанию `lst`) |

## Пример сгенерированных файлов

```text
#service1
api.service1.com #service1
users.service1.com #service1
service1.com #service1

#service2
api.service2.com #service2
service2.com #service2
```

Пример CIDR (`cidr4/AS15169.lst`):

```text
142.250.0.0/15
172.217.0.0/16
```
