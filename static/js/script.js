const MONTHS = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

function createWeeks() {
    const weeks = document.getElementById('weeks');
    const months = document.getElementById('months');
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1); // 1 января текущего года
    const endOfYear = new Date(today.getFullYear(), 11, 31); // 31 декабря текущего года

    // Добавляем пустые дни перед началом года
    const startDayOfWeek = startOfYear.getDay(); // 0 (воскресенье) до 6 (суббота)
    let offsetDays = (startDayOfWeek === 0) ? 6 : startDayOfWeek - 1; // Пустые квадраты для дней до понедельника

    if (offsetDays > 0) {
        const emptyWeek = document.createElement('div');
        emptyWeek.className = 'week';
        weeks.appendChild(emptyWeek);
        for (let i = 0; i < offsetDays; i++) {
            const square = document.createElement('div');
            square.className = 'square level-0'; // Пустой квадрат
            emptyWeek.appendChild(square);
        }
    }

    let currentMonth = '';
    let monthWidth = offsetDays;
    let currentWeek;

    // Проходим по всем дням года
    for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
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
        square.className = `square level-${Math.min(Math.floor((yearlyData[dateStr] || 0) / 1), 4)}`;
        square.title = `${dateStr}: ${yearlyData[dateStr] || 0} задач`;
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

        // Останавливаем добавление дней после сегодняшнего
        if (d.getTime() > today.getTime()) break;
    }

    // Добавляем последний месяц
    if (currentMonth) {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.style.width = `${monthWidth * 18 - 10}px`;
        monthLabel.textContent = currentMonth;
        months.appendChild(monthLabel);
    }
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

        if (task.subtasks) {
            task.subtasks.forEach((subtask, subIndex) => {
                const subtaskElement = document.createElement('div');
                subtaskElement.className = 'subtask';

                const subLabel = document.createElement('label');
                const subCheckbox = document.createElement('input');
                subCheckbox.type = 'checkbox';
                subCheckbox.dataset.index = `${index}.${subIndex}`;
                subCheckbox.checked = progress[`${index}.${subIndex}`] || false;

                subCheckbox.addEventListener('change', () => {
                    progress[`${index}.${subIndex}`] = subCheckbox.checked;
                    subLabel.classList.toggle('checked', subCheckbox.checked);
                    saveProgress();
                });

                subLabel.appendChild(subCheckbox);
                subLabel.appendChild(document.createTextNode(subtask));
                subtaskElement.appendChild(subLabel);
                taskElement.appendChild(subtaskElement);
            });
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
        tasks.push({ name: taskName, subtasks: [] });
        taskInput.value = '';
        renderTasks();
        hideModal('taskManagement');
    }
}

function addSubtask() {
    const subtaskInput = document.createElement('input');
    subtaskInput.type = 'text';
    subtaskInput.placeholder = 'Название подзадачи';
    const subtaskContainer = document.getElementById('subtasksContainer');
    subtaskContainer.appendChild(subtaskInput);
}

document.addEventListener("DOMContentLoaded", () => {
    createWeeks();
    renderTasks();
});