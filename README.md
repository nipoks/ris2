# Hash Cracking Worker System

Этот проект представляет собой систему для параллельного поиска строк, которые соответствуют заданному MD5 хэшу. Процесс разбивается на несколько воркеров, каждый из которых обрабатывает часть возможных строк, и результаты отправляются менеджеру.

# Содержание:
- Схема системы
- Установка
- Пример использования
- Ссылки на UI инструменты (от docker-compose и .env зависит)
- Пример .env файлов

## Структура проекта
![img.png](img/img.png)
![img.png](img/img_2.png)

### Проект состоит из нескольких сервисов:

- **manager**: Сервис, который управляет распределением задач и сбором результатов.
- **worker**: Рабочие сервисы, которые выполняют фактическую работу по вычислению строк и хэшированию.
- **rabbit**: Брокер сообщений для передачи данных между manager и worker
- **mongo**: База хранения данных о задачах (3 реплики)
- **mongo-express**: UI для просмотра данных в базе 


### Технологии:
- **Node.js** - основной язык для разработки.
- **Express.js** - веб-фреймворк для создания API.
- **Worker Threads** - для выполнения вычислений в отдельных потоках.
- **Axios** - для отправки HTTP-запросов.
- **MD5** - для хэширования строк.
- **SharedMap** - для сохранения процента выполнения задачи из разных потоков (https://www.npmjs.com/package/sharedmap).
- **amqplib**: для подключения к rabbitmq

___

## Установка

Для того, чтобы запустить проект, нужно:

### 1. Клонировать репозиторий:
```
git clone https://github.com/nipoks/ris2.git
cd ./ris2
```
### 2. Добавить env переменные для двух сущностей:

```
cd ./manager
make env
cd ../worker
make env
```
Заполните данные
### 3. Поставить на файл (в корне) mongo-keyfile права на чтение 
#### На MAC:
```
chmod 400 mongo-keyfile
```
### 4. Запустить проект из корневой папки с помощью Docker Compose:
```
docker-compose up --build
```
Снести
```
docker-compose down -v
```
___
## Пример использования
Сайт для генерации хэша по слову: https://www.md5hashgenerator.com/
### 1. Отправка запроса начала:
```
curl -X POST http://localhost:3000/api/hash/crack -H "Content-Type: application/json" -d '{"hash":"3cbdc7e3769a8b04d992a8f93f58c7b9", "maxLength": 5}'
```
Параметры запроса (JSON):

* hash (строка) - искомый MD5 хэш.
* maxLength (целое число) - максимальная длина строки.

Ответ: d13es (~16 сек)

### 2. Получение статуса задачи
```
curl -X GET http://localhost:3000/api/hash/status?requestId=
```
requestId - id который вернул менеджер после создания задачи
* PART_ANSWER_IS_READY - случилась ошибка у воркера, но кто-то нашел вариант ответа
* IN_PROGRESS - кто-то еще работает
* READY - все воркеры отработали успешно
* ERROR
  
Пример ответа:
```
{  "status" : "IN_PROGRESS",
   "data" : {
              "answer" : null,
              "progress" : "22%"
             }
}
```
___ 
## Ссылки
- Rabbit WEB http://localhost:15672/
- Mongo-express http://localhost:8081/db
---
## Пример .env
### Manager
```
WORKERS=http://worker1:4000,http://worker2:4000,http://worker3:4000
WORKERS_QUEUES=worker1_queue,worker2_queue,worker3_queue
PORT=3000
MONGO_URI=mongodb://admin:pass@mongo-primary:27017,mongo-secondary1:27017,mongo-secondary2:27017/?replicaSet=rs0
DB_NAME=ris2
RABBIT_URI=amqp://guest:guest@rabbitmq:5672
ANSWER_QUEUE=answer_q
STATUS_QUEUE=status_q
TASK_QUEUE=task_q
```
### Worker
```
MANAGER=http://manager:3000
PORT=4000
RABBIT_URI=amqp://guest:guest@rabbitmq:5672
TASK_QUEUE=task_q
ANSWER_QUEUE=answer_q
STATUS_QUEUE=status_q
```