# План рефакторинга domain-lists

Документ для поэтапной реализации: секции конфига, мульти-инстанс opencck, поддержка IP/CIDR, BGP ASN, раздельное хранение файлов.

**Целевая структура вывода:**

```text
data/
  global/
    domains/
      telegram.lst
      youtube.lst
    cidr4/
      youtube.lst
      AS15169.lst
    .generated_files
  russia/
    domains/
      avito.ru.lst
    cidr4/
      avito.ru.lst
    .generated_files
```

---

## Принципы

- [x] Обратная совместимость: старый flat-конфиг без `sections` работает как раньше
- [x] Минимальный diff на каждом этапе; каждый этап — рабочее состояние
- [x] Секции обрабатываются независимо
- [x] Домены и CIDR — в разных подпапках (`outputLayout`)
- [x] IP/CIDR только из провайдеров, без DNS-резолва
- [x] `.generated_files` и cleanup — per output directory; несколько секций в одну папку объединяются в конце run

---

## Этап 0. Подготовка абстракций

**Цель:** заложить типы и контракты без изменения поведения.

### 0.1. Файл `types.js`

- [x] Константы `RecordType`: `domain`, `ipv4`, `ipv6`, `cidr4`, `cidr6`
- [x] Экспорт списка всех типов для валидации конфига

### 0.2. Расширить `utils.js`

- [x] `isValidIpv4(value)`
- [x] `isValidIpv6(value)`
- [x] `isValidCidr4(value)` — формат `a.b.c.d/prefix`, prefix 0–32
- [x] `isValidCidr6(value)` — prefix 0–128
- [x] `filterRecords(type, items)` — диспетчер по типу
- [x] Сохранить `filterDomains` как alias/wrapper для `filterRecords('domain', ...)`

### 0.3. Контракт провайдера v2

- [x] `init(options?)`
- [x] `getServicesForGroup(group, resultList)` — без изменений
- [x] `getRecordsForService(service, recordTypes)` — plain object `{ domain: [], cidr4: [] }`
- [x] Legacy `getDomainsForService` сохранён у opencck

### 0.4. Вынести запись файлов

- [x] Создать `output/OutputManager.js`
- [x] Создать `output/templates.js` — `applyTemplate(template, { record, service, type })`
- [x] `OutputManager.finalize(allGeneratedFiles?)` — cleanup с объединением файлов из нескольких секций

**Критерий готовности:** run со старым конфигом даёт тот же результат в `lists/`.

---

## Этап 1. Секции конфига

**Цель:** независимые секции с `outputDir` и `outputLayout`.

### 1.1. Схема конфига

```json
{
  "sections": [
    {
      "name": "global-domains",
      "outputDir": "data/global",
      "recordTypes": ["domain"],
      "outputLayout": {
        "domain": "domains",
        "cidr4": "cidr4"
      },
      "providers": ["opencck-main", "metacube", "v2fly"],
      "groups": [],
      "services": [],
      "additionalLists": {},
      "maxFileEntries": -1,
      "generateIndividualFiles": true,
      "generateCombinedFiles": false,
      "domainTemplate": "{{record}}\n",
      "cidr4Template": "{{record}}\n",
      "fileExtension": "lst"
    }
  ]
}
```

### 1.2. Парсинг конфига

- [x] Создать `config/loadConfig.js`
- [x] Если `sections` отсутствует — обернуть top-level поля в одну секцию `default`

### 1.3. Рефакторинг `index.js`

- [x] Цикл по секциям
- [x] Финализация с группировкой по `outputDir`

### 1.4. Именование файлов

| recordType | Папка (layout) | Имя файла |
|------------|----------------|-----------|
| domain | `domains/` | `{service}.lst` |
| cidr4 | `cidr4/` | `{service}.lst` или `AS{num}.lst` |
| combined | та же папка | `_all_in_one.lst` |

### 1.5. `additionalLists`

- [x] Формат `{ "key": ["url1"] }` → type = domain
- [x] Расширенный формат с `type` и `urls`

**Критерий готовности:** две секции с разными или общими `outputDir` работают корректно.

---

## Этап 2. Реестр провайдеров и мульти-инстанс opencck

**Цель:** main / beta / russia как независимые провайдеры.

### 2.1. `providers/registry.js`

- [x] Фабрики провайдеров по id
- [x] `resolveProviders(ids)` → массив инстансов

### 2.2. Рефакторинг `providers/iplistOpenckk.js`

- [x] Экспорт `createOpenCkkProvider({ id, baseUrl, serviceMap })`
- [x] Изолированные `services2sites`, `groups2services` per instance

### 2.3. Особенности каталогов opencck

| Портал | ~сайтов | Назначение |
|--------|---------|------------|
| main | 220 | Международные сервисы |
| beta | 99 | Доп. сервисы (adobe, amazon…) |
| russia | 86 | Российские сервисы (avito, 2gis…) |

- [x] Для russia portal name как service (`avito.ru`, не `avito`)
- [x] Site key в API = полное имя (`telegram.org`, `youtube.com`)

### 2.4. Адаптация metacube и v2fly

- [x] `getRecordsForService` — только `domain`

**Критерий готовности:** три opencck-инстанса генерируют корректные файлы.

---

## Этап 3. IP и CIDR из opencck

**Цель:** собирать ip4/cidr4/ip6/cidr6 без DNS-резолва.

### 3.1. Расширить `createOpenCkkProvider`

- [x] Fetch `data=domains|ip4|cidr4|ip6|cidr6` per site
- [x] Фильтрация через `filterRecords(type, entries)`

### 3.2. Шаблоны и конфиг

- [x] `ipv4Template`, `ipv6Template`, `cidr4Template`, `cidr6Template` per section

### 3.3. Пример секции с CIDR

```json
{
  "name": "global-cidr",
  "outputDir": "data/global",
  "recordTypes": ["cidr4"],
  "outputLayout": { "cidr4": "cidr4" },
  "providers": ["opencck-main"],
  "services": ["youtube.com", "telegram.org"]
}
```

**Критерий готовности:** `data/global/cidr4/youtube.lst` содержит CIDR из opencck main.

---

## Этап 4. Дополнительные провайдеры IP

**Цель:** внешние списки и ASN/BGP.

### 4.1. `providers/githubLists.js`

- [ ] Читает URL из `additionalLists` с указанием type
- [ ] Plain text (одна запись на строку)

### 4.2. `providers/bgpAsn.js`

- [x] Сервисы вида `AS15169`
- [x] Источник: RIPE Stat `announced-prefixes` API
- [ ] Кеш ответов на время run (опционально)
- [ ] Rate limit: задержка между запросами (опционально)

### 4.3. Регистрация в registry

- [x] `bgpAsn`
- [ ] `github-lists`

**Критерий готовности:** ASN-префиксы попадают в `{outputDir}/cidr4/`.

---

## Этап 5. Миграция конфигов и документация

### 5.1. Пример конфига

- [x] `sample-config.json` с sections
- [ ] Актуализировать production-конфиг (CONFIG_CONTENT)

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
      "services": ["telegram", "discord", "github"]
    },
    {
      "name": "global-cidr",
      "outputDir": "data/global",
      "recordTypes": ["cidr4"],
      "outputLayout": { "cidr4": "cidr4" },
      "providers": ["opencck-main", "bgpAsn"],
      "services": ["youtube.com", "telegram.org", "AS15169"]
    },
    {
      "name": "russia",
      "outputDir": "data/russia",
      "recordTypes": ["domain", "cidr4"],
      "outputLayout": { "domain": "domains", "cidr4": "cidr4" },
      "providers": ["opencck-russia"],
      "services": ["avito.ru", "2gis.ru", "alfabank.ru"]
    }
  ]
}
```

### 5.2. Документация

- [x] Обновить `Readme.md` — sections, outputLayout, recordTypes, провайдеры
- [x] Обновить `.cursor/rules/*.mdc` и `AGENTS.md`

---

## Этап 6. Полировка (опционально)

- [ ] `--dry-run` — лог без записи файлов
- [ ] JSON Schema для конфига
- [ ] Unit-тесты: validators, template, config migration
- [ ] `maxPrefixLength` — фильтр слишком широких префиксов
- [ ] Merge overlapping CIDR

---

## Порядок PR / коммитов

| # | Scope | Статус |
|---|-------|--------|
| 1 | types + utils validators | done |
| 2 | OutputManager | done |
| 3 | Sections config + backward compat | done |
| 4 | Provider registry + opencck factory | done |
| 5 | opencck IP/CIDR | done |
| 6 | bgpAsn provider | done |
| 7 | Docs + sample config | done |

---

## Риски и mitigations

| Риск | Mitigation |
|------|------------|
| beta/russia не содержат сервис из main | Явные `services` per section; лог `[provider] 0 records` |
| Огромные IPv6-листы | `recordTypes` без ipv6 по умолчанию |
| Широкие CIDR (/8, /9) | `maxPrefixLength`, предупреждение в логах |
| RIPE Stat rate limit | Кеш + delay |
| Несколько секций в один outputDir | Объединение `.generated_files` в `index.js` |

---

## Ссылки

- [opencck main](https://iplist.opencck.org)
- [opencck beta](https://beta.iplist.opencck.org)
- [opencck russia](https://russia.iplist.opencck.org)
- [RIPE Stat announced-prefixes](https://stat.ripe.net/docs/data-api/api-endpoints/announced-prefixes)
- [rekryt/iplist README](https://github.com/rekryt/iplist/blob/master/README.en.md) — API params `data=ip4|cidr4|ip6|cidr6|domains`
