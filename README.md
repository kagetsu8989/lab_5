# Хаясан, гээсэн эд зүйлсийг бүртгэх систем

## Ашиглах технологи
- Node.js + Express
- MySQL
- MySQL Workbench

## 1. Шаардлага
Node.js болон MySQL Server суусан байна. MySQL Workbench нь database удирдах хэрэгсэл; MySQL Server ажиллаж байх шаардлагатай.

## 2. Database үүсгэх
1. MySQL Workbench нээнэ.
2. Local connection-д холбогдоно.
3. `database/lost_found_db.sql` файлыг нээгээд бүх SQL-ийг ажиллуулна.
4. `users` хүснэгтээс `user_id` утгыг харна. Жишээ хэрэглэгч `test@example.com`.

## 3. VS Code дээр ажиллуулах
Төслийн хавтсыг VS Code-оор нээнэ. Terminal нээгээд:

```bash
npm install
```

`.env.example` файлыг хуулж `.env` нэртэй болгоод MySQL-ийн тохиргоогоо бичнэ:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=таны_mysql_password
DB_NAME=lost_found_db
```

MySQL root хэрэглэгч password-гүй бол `DB_PASSWORD=` гэж хоосон үлдээнэ.

Сервер асаах:

```bash
npm run dev
```

Хөтөчөөр `http://localhost:3000` нээж шалгана.

## 4. API тестлэх

### Эрүүл мэндийн шалгалт
- Method: GET
- URL: `http://localhost:3000/api/health`

### Гээсэн эд зүйл бүртгэх
- Method: POST
- URL: `http://localhost:3000/api/lost-items`
- Header: `Content-Type: application/json`
- Body (raw JSON):

```json
{
  "user_id": 1,
  "item_name": "Хар өнгийн түрийвч",
  "category": "Хувийн эд зүйл",
  "description": "Дотор нь бичиг баримт байсан.",
  "lost_date": "2026-11-04",
  "lost_location": "Улаанбаатар хот, Сүхбаатар дүүрэг"
}
```

`user_id`-г Workbench-ийн `SELECT user_id, name, email FROM users;` үр дүнтэй тааруулна.

### Жагсаалт харах
- Method: GET
- URL: `http://localhost:3000/api/lost-items`

## 5. GitHub-д байршуулах
`.env` болон `node_modules`-ийг GitHub-д оруулахгүй. `.gitignore` бэлэн байгаа.

```bash
git init
git add .
git commit -m "Initial lost and found API"
git branch -M main
git remote add origin https://github.com/USERNAME/lost-found-system.git
git push -u origin main
```

`USERNAME`-ийг өөрийн GitHub username-аар солино.
