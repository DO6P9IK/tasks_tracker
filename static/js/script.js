const MONTHS = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

function createWeeks() {
    const weeks = document.getElementById('weeks');
    const months = document.getElementById('months');
    const today = new Date();
    const startDate = new Date(today); // Начинаем с текущей даты
    startDate.setDate(today.getDate() - 363); // Отнимаем 363 дня, чтобы получить ровно 52 недели (364 дня)

    // Находим ближайший понедельник перед startDate
    while (startDate.getDay() !== 1) { // 1 — это понедельник
        startDate.setDate(startDate.getDate() - 1);
    }

    // Очищаем предыдущие данные
    weeks.innerHTML = '';
    months.innerHTML = '';

    let currentMonth = '';
    let monthWidth = 0;
    let currentWeek;

    // Проходим по всем дням за последние 52 недели (364 дня)
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const month = MONTHS[d.getMonth()];

        // Создаем новую колонку для недели, если это понедельник (день недели = 1)
        if (d.getDay() === 1 || !currentWeek) {
            currentWeek = document.createElement('div');
            currentWeek.className = 'week';
            weeks.appendChild(currentWeek);
            monthWidth++;
        }

        const square = document.createElement('div');
        const completedTasks = yearlyData[dateStr] || 0; // Количество выполненных задач
        const level = Math.min(Math.floor(completedTasks / 1), 4); // Уровень цвета (от 0 до 4)
        square.className = `square level-${level}`;
        square.title = `${dateStr}: ${completedTasks} задач`;
        currentWeek.appendChild(square);

        // Проверяем смену месяца
        if (currentMonth !== month) {
            if (currentMonth !== '') {
                const monthLabel = document.createElement('div');
                monthLabel.className = 'month-label';
                monthLabel.style.width = `${monthWidth * 18 - 10}px`;
                monthLabel.textContent = currentMonth;
                months.appendChild(monthLabel);
            }
            currentMonth = month;
            monthWidth = 0;
        }
    }

    // Добавляем последний месяц
    if (currentMonth) {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.style.width = `${monthWidth * 18 - 10}px`;
        monthLabel.textContent = currentMonth;
        months.appendChild(monthLabel);
    }

    console.log('Трекер прогресса отрисован:', { startDate, today, yearlyData });
}

function renderTasks() {
    const tasksContainer = document.getElementById('tasks');
    tasksContainer.innerHTML = '';

    tasks.forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task';

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.index = index;
        checkbox.checked = progress[index] || false;

        checkbox.addEventListener('change', () => {
            progress[index] = checkbox.checked;
            label.classList.toggle('checked', checkbox.checked);
            saveProgress();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(task.name));
        taskElement.appendChild(label);

        if (checkbox.checked) {
            label.classList.add('checked'); // Добавляем класс checked, если задача уже выполнена
        }

        tasksContainer.appendChild(taskElement);
    });
}

function saveProgress() {
    fetch("/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, tasks })
    })
    .then(response => response.json())
    .then(data => {
        location.reload();
    });
}

function showModal(type) {
    if (type === 'register') {
        getCaptcha();
    }
    document.getElementById(`${type}Modal`).style.display = 'block';
}

function hideModal(type) {
    document.getElementById(`${type}Modal`).style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

async function getCaptcha() {
    try {
        const response = await fetch('/get_captcha');
        const data = await response.json();
        const captchaContainer = document.getElementById('captchaContainer');
        captchaContainer.innerHTML = `
            <p>${data.question}</p>
            <input type="hidden" name="captchaAnswer" value="${data.answer}">
        `;
    } catch (error) {
        console.error('Ошибка при получении капчи:', error);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');
    
    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: password,
                confirmPassword: confirmPassword,
                captcha: formData.get('captcha'),
                captchaAnswer: formData.get('captchaAnswer')
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            location.reload();
        } else {
            alert(data.message);
            if (data.message === "Неверный ответ на капчу") {
                getCaptcha();  // Обновляем капчу после неверного ответа
            }
        }
    } catch (error) {
        alert('Произошла ошибка при регистрации');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            location.reload();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Произошла ошибка при входе');
    }
}

function addTask() {
    const taskInput = document.getElementById('taskInput');
    const taskName = taskInput.value.trim();
    if (taskName) {
        tasks.push({ name: taskName }); // Добавляем задачу без подзадач
        taskInput.value = ''; // Очищаем поле ввода
        renderTasks(); // Перерисовываем список задач
        hideModal('taskManagement'); // Закрываем модальное окно
    }
}

document.addEventListener("DOMContentLoaded", () => {
    createWeeks();
    renderTasks();
});