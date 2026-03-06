# Domain List Aggregator

*Created for educational purposes only.*

This project aggregates domain lists from several public sources and generates structured output files that can be used for filtering, allowlists, or analysis.

Data sources:

- https://iplist.opencck.org
- https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo/geosite
- https://github.com/v2fly/domain-list-community

## Setup

1. Fork this repository.
2. Adjust the workflow schedule in `.github/workflows/generate.yml` to match your preferred execution time.
3. In the repository settings, create a secret named `CONFIG_CONTENT` and paste the application configuration there.

The workflow will read this configuration and generate the domain lists automatically.  
All generated files are stored in the `lists/` folder, and the file `lists/.generated_files` contains a list of all generated filenames.

## Example Configuration

```json
{
  "maxFileEntries": 300,
  "generateIndividualFiles": true,
  "generateCombinedFiles": true,
  "perServiceTemplate": "#{{service}}\n",
  "domainTemplate": "{{domain}} #{{service}}\n",
  "fileExtension":"lst",
  "groups": [
    "anime","art","education","games","music","news","shop","socials","tools","video"
  ],
  "services": [
    "jetbrains","intel","themoviedb","nvidia"
  ],
  "additionalLists":{
    "example":["https://my.example.com/domains.list"]
  }
}
```

## Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `maxFileEntries` | integer | Maximum number of entries per generated file. `-1` indicates no limit. |
| `generateIndividualFiles` | boolean | Generate separate files for each service. |
| `generateCombinedFiles` | boolean | Generate a single combined list containing all services. |
| `perServiceTemplate` | string | Template inserted before each service block in the files. |
| `domainTemplate` | string | Template used for each domain entry. |
| `fileExtension` | string | File extension for generated files. |
| `groups` | array of strings | Groups to include (supported only for https://iplist.opencck.org). |
| `services` | array of strings | Services for which domain lists will be generated. |
| `additionalLists` | object | Key-value pairs where the key is the service name and the value is an array of external domain list URLs. |

## Example Output

```text
#service1
api.service1.com #service1
users.service1.com #service1
data.service1.com #service1
service1.com #service1

#service2
api.service2.com #service2
users.service2.com #service2
service2.com #service2
```

All generated files are stored in the `lists/` folder, and `lists/.generated_files` contains the list of all generated filenames.

---

# Агрегатор списков доменов

*Создан сугубо в образовательных целях.*

Этот проект агрегирует списки доменов из нескольких публичных источников и генерирует итоговые файлы, которые можно использовать для фильтрации, allowlist-ов или анализа.

Источники данных:

- https://iplist.opencck.org
- https://github.com/MetaCubeX/meta-rules-dat/tree/sing/geo/geosite
- https://github.com/v2fly/domain-list-community

## Настройка

1. Сделайте форк этого репозитория.
2. Измените расписание запуска в `.github/workflows/generate.yml` на удобное для вас.
3. В настройках репозитория создайте секрет `CONFIG_CONTENT` и вставьте туда конфигурацию приложения.

Workflow будет использовать эту конфигурацию и автоматически генерировать списки доменов.  
Все сгенерированные файлы лежат в папке `lists/`, а `lists/.generated_files` содержит список всех файлов.

## Пример конфигурации

```json
{
  "maxFileEntries": 300,
  "generateIndividualFiles": true,
  "generateCombinedFiles": true,
  "perServiceTemplate": "#{{service}}\n",
  "domainTemplate": "{{domain}} #{{service}}\n",
  "fileExtension":"lst",
  "groups": [
    "anime","art","education","games","music","news","shop","socials","tools","video"
  ],
  "services": [
    "jetbrains","intel","themoviedb","nvidia"
  ],
  "additionalLists":{
    "example":["https://my.example.com/domains.list"]
  }
}
```

## Параметры конфигурации

| Параметр | Тип | Описание |
|-----------|-----|----------|
| `maxFileEntries` | integer | Максимальное количество записей на один сгенерированный файл. `-1` означает без ограничения. |
| `generateIndividualFiles` | boolean | Генерировать отдельные файлы для каждого сервиса. |
| `generateCombinedFiles` | boolean | Генерировать один общий список со всеми сервисами. |
| `perServiceTemplate` | string | Шаблон, вставляемый перед блоком сервиса в файлах. |
| `domainTemplate` | string | Шаблон для каждой записи домена. |
| `fileExtension` | string | Расширение для сгенерированных файлов. |
| `groups` | array of strings | Группы для включения (поддерживаются только для https://iplist.opencck.org). |
| `services` | array of strings | Сервисы, для которых будут сгенерированы списки доменов. |
| `additionalLists` | object | Ключ — имя сервиса, значение — массив URL внешних списков доменов. |

## Пример сгенерированных файлов

```text
#service1
api.service1.com #service1
users.service1.com #service1
data.service1.com #service1
service1.com #service1

#service2
api.service2.com #service2
users.service2.com #service2
service2.com #service2
```

Все сгенерированные файлы лежат в папке `lists/`, а `lists/.generated_files` содержит список всех файлов.