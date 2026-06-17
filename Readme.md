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
Generated files are stored under each section's `outputDir`; `.generated_files` in that directory lists all managed filenames.

Local run:

```bash
echo 'CONFIG_PATH=./sample-config.json' > .env
npm install
node index.js
```

## Configuration (sections)

The config is an array of **sections**. Each section defines its own output directory, record types, data providers, and services.

Legacy flat config (without `sections`) is still supported and is treated as a single default section.

```json
{
  "sections": [
    {
      "name": "global-domains",
      "outputDir": "data/global",
      "recordTypes": ["domain"],
      "outputLayout": { "domain": "domains" },
      "providers": ["opencck-main", "metacube", "v2fly"],
      "groups": ["youtube", "games", "tools"],
      "services": ["telegram", "discord", "github"],
      "generateIndividualFiles": true,
      "generateCombinedFiles": true,
      "domainTemplate": "{{record}} #{{service}}\n"
    },
    {
      "name": "global-cidr",
      "outputDir": "data/global",
      "recordTypes": ["cidr4"],
      "outputLayout": { "cidr4": "cidr4" },
      "providers": ["opencck-main", "bgpAsn"],
      "services": ["youtube.com", "telegram.org", "AS15169"],
      "generateIndividualFiles": true
    },
    {
      "name": "russia",
      "outputDir": "data/russia",
      "recordTypes": ["domain", "cidr4"],
      "outputLayout": { "domain": "domains", "cidr4": "cidr4" },
      "providers": ["opencck-russia"],
      "services": ["avito.ru", "2gis.ru", "alfabank.ru"],
      "generateIndividualFiles": true
    }
  ]
}
```

Multiple sections may share the same `outputDir` (e.g. domains and CIDR in separate sections). Cleanup and `.generated_files` are merged at the end of the run.

### Providers

| ID | Description |
|----|-------------|
| `opencck-main` | iplist.opencck.org — groups, domains, IP, CIDR |
| `opencck-beta` | beta.iplist.opencck.org |
| `opencck-russia` | russia.iplist.opencck.org |
| `metacube` | MetaCubeX geosite JSON (domains) |
| `v2fly` | v2fly domain-list-community (domains) |
| `bgpAsn` | RIPE Stat announced prefixes for `AS{number}` services |

For BGP, add services like `"AS15169"` or `"AS13335"` and include `cidr4` / `cidr6` in `recordTypes`.

## Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `sections` | array | List of generation sections |
| `name` | string | Section label (logging) |
| `outputDir` | string | Root output directory for the section |
| `recordTypes` | array | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `outputLayout` | object | Subfolder per record type, e.g. `{ "domain": "domains" }` |
| `providers` | array | Provider IDs from the table above |
| `groups` | array | opencck groups; expands `services` |
| `services` | array | Service names or ASN identifiers |
| `additionalLists` | object | External URLs; key becomes `_key` service |
| `maxFileEntries` | integer | Max entries per file; `-1` = no limit |
| `generateIndividualFiles` | boolean | One file per service |
| `generateCombinedFiles` | boolean | Combined `_all_in_one.lst` |
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
Результаты лежат в `outputDir` каждой секции; `.generated_files` — индекс управляемых файлов.

Локальный запуск:

```bash
echo 'CONFIG_PATH=./sample-config.json' > .env
npm install
node index.js
```

## Конфигурация (секции)

Конфиг — массив **секций**. Каждая задаёт каталог вывода, типы записей, провайдеры и сервисы.

Старый flat-конфиг без `sections` поддерживается как одна секция по умолчанию.

```json
{
  "sections": [
    {
      "name": "global-domains",
      "outputDir": "data/global",
      "recordTypes": ["domain"],
      "outputLayout": { "domain": "domains" },
      "providers": ["opencck-main", "metacube", "v2fly"],
      "groups": ["youtube", "games", "tools"],
      "services": ["telegram", "discord", "github"],
      "generateIndividualFiles": true,
      "generateCombinedFiles": true,
      "domainTemplate": "{{record}} #{{service}}\n"
    },
    {
      "name": "global-cidr",
      "outputDir": "data/global",
      "recordTypes": ["cidr4"],
      "outputLayout": { "cidr4": "cidr4" },
      "providers": ["opencck-main", "bgpAsn"],
      "services": ["youtube.com", "telegram.org", "AS15169"],
      "generateIndividualFiles": true
    },
    {
      "name": "russia",
      "outputDir": "data/russia",
      "recordTypes": ["domain", "cidr4"],
      "outputLayout": { "domain": "domains", "cidr4": "cidr4" },
      "providers": ["opencck-russia"],
      "services": ["avito.ru", "2gis.ru", "alfabank.ru"],
      "generateIndividualFiles": true
    }
  ]
}
```

Несколько секций могут писать в один `outputDir`. Очистка и `.generated_files` объединяются в конце запуска.

### Провайдеры

| ID | Описание |
|----|----------|
| `opencck-main` | iplist.opencck.org — группы, домены, IP, CIDR |
| `opencck-beta` | beta.iplist.opencck.org |
| `opencck-russia` | russia.iplist.opencck.org |
| `metacube` | MetaCubeX geosite JSON (домены) |
| `v2fly` | v2fly domain-list-community (домены) |
| `bgpAsn` | RIPE Stat, префиксы для сервисов `AS{номер}` |

Для BGP добавьте сервисы вида `"AS15169"` и укажите `cidr4` / `cidr6` в `recordTypes`.

## Параметры конфигурации

| Параметр | Тип | Описание |
|----------|-----|----------|
| `sections` | array | Список секций генерации |
| `name` | string | Имя секции (логи) |
| `outputDir` | string | Корневая папка вывода |
| `recordTypes` | array | `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6` |
| `outputLayout` | object | Подпапка на тип записи |
| `providers` | array | ID провайдеров |
| `groups` | array | Группы opencck; расширяют `services` |
| `services` | array | Имена сервисов или ASN |
| `additionalLists` | object | Внешние URL; ключ → сервис `_key` |
| `maxFileEntries` | integer | Лимит записей на файл; `-1` = без лимита |
| `generateIndividualFiles` | boolean | Отдельный файл на сервис |
| `generateCombinedFiles` | boolean | Общий `_all_in_one.lst` |
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
