from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import date, datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import json
import random

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # Измените на реальный секретный ключ

def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS user_progress 
                 (user_id INTEGER,
                  date TEXT,
                  progress TEXT,
                  tasks TEXT,
                  FOREIGN KEY (user_id) REFERENCES users(id))''')
    conn.commit()
    conn.close()

def load_data(user_id):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT date, progress, tasks FROM user_progress WHERE user_id = ?', (user_id,))
    results = c.fetchall()
    conn.close()
    
    data = {}
    for date_str, progress, tasks in results:
        data[date_str] = {
            'progress': json.loads(progress),
            'tasks': json.loads(tasks)
        }
    return data

def save_data(user_id, date_str, progress, tasks):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('INSERT OR REPLACE INTO user_progress (user_id, date, progress, tasks) VALUES (?, ?, ?, ?)',
              (user_id, date_str, json.dumps(progress), json.dumps(tasks)))
    conn.commit()
    conn.close()

def get_streak(user_id):
    data = load_data(user_id)
    today = date.today()
    streak = 0
    max_streak = 0
    current_date = today
    
    while str(current_date) in data:
        if any(data[str(current_date)]['progress']):
            streak += 1
            max_streak = max(streak, max_streak)
        else:
            break
        current_date -= timedelta(days=1)
    return streak, max_streak

def get_yearly_data(user_id):
    data = load_data(user_id)
    today = date.today()
    year_ago = today - timedelta(days=365)
    yearly_data = {}
    current = year_ago
    
    while current <= today:
        str_date = str(current)
        if str_date in data:
            completed = sum(1 for x in data[str_date]['progress'] if x)
            yearly_data[str_date] = completed
        else:
            yearly_data[str_date] = 0
        current += timedelta(days=1)
    return yearly_data

def capcha_question():
    nums_dict = {0: 'нoль', 1: 'oдин', 2: 'двa', 3: 'тpи', 4: 'чeтырe', 
                 5: 'пять', 6: 'шeсть', 7: 'ceмь', 8: 'вoceмь', 9: 'дeвять'}
    
    first_num = random.randint(0, 9)
    second_num = random.randint(0, 9)
    operator = random.choice(['плюc', 'умнoжить нa'])

    operations = {
        'плюc': lambda x, y: x + y,
        'умнoжить нa': lambda x, y: x * y
    }

    result = str(operations[operator](first_num, second_num))
    control_phrase = f'{nums_dict[first_num]} {operator} {nums_dict[second_num]}'

    return control_phrase, result

@app.route("/")
def index():
    if 'user_id' not in session:
        return render_template("index.html", 
                             logged_in=False,
                             streak=0,
                             max_streak=0,
                             yearly_data={},
                             total_tasks=0,
                             progress=[],
                             tasks=[])
    
    user_id = session['user_id']
    streak, max_streak = get_streak(user_id)
    yearly_data = get_yearly_data(user_id)
    total_tasks = sum(yearly_data.values())
    
    # Загружаем прогресс и задачи для текущего дня
    today = str(date.today())
    data = load_data(user_id)
    progress = data.get(today, {}).get('progress', [])
    tasks = data.get(today, {}).get('tasks', [])
    
    return render_template("index.html",
                         logged_in=True,
                         username=session.get('username'),
                         streak=streak,
                         max_streak=max_streak,
                         yearly_data=yearly_data,
                         total_tasks=total_tasks,
                         progress=progress,
                         tasks=tasks)

@app.route("/get_captcha", methods=["GET"])
def get_captcha():
    question, answer = capcha_question()
    return jsonify({"question": question, "answer": answer})

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    confirm_password = data.get('confirmPassword')
    captcha = data.get('captcha')
    captcha_answer = data.get('captchaAnswer')
    
    if not username or not password or not confirm_password:
        return jsonify({"status": "error", "message": "Необходимо заполнить все поля"}), 400
    
    if password != confirm_password:
        return jsonify({"status": "error", "message": "Пароли не совпадают"}), 400
    
    if str(captcha) != str(captcha_answer):
        return jsonify({"status": "error", "message": "Неверный ответ на капчу"}), 400
    
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    try:
        hashed_password = generate_password_hash(password)
        c.execute('INSERT INTO users (username, password) VALUES (?, ?)',
                 (username, hashed_password))
        conn.commit()
        
        user_id = c.lastrowid
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({"status": "success", "message": "Регистрация успешна"})
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "Пользователь уже существует"}), 400
    finally:
        conn.close()

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"status": "error", "message": "Необходимо указать имя пользователя и пароль"}), 400
    
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('SELECT id, password FROM users WHERE username = ?', (username,))
    user = c.fetchone()
    conn.close()
    
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['username'] = username
        return jsonify({"status": "success", "message": "Вход выполнен успешно"})
    else:
        return jsonify({"status": "error", "message": "Неверное имя пользователя или пароль"}), 401

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route("/update", methods=["POST"])
def update():
    if 'user_id' not in session:
        return jsonify({"status": "error", "message": "Необходима авторизация"}), 401
    
    user_id = session['user_id']
    today = str(date.today())
    progress = request.json.get("progress", [])
    tasks = request.json.get("tasks", [])
    
    save_data(user_id, today, progress, tasks)
    streak, max_streak = get_streak(user_id)
    
    return jsonify({
        "status": "success",
        "streak": streak,
        "max_streak": max_streak,
        "progress": progress,
        "tasks": tasks
    })

if __name__ == "__main__":
    init_db()
    app.run(debug=True)