// Константы для амплитуды изменений
const GAS_LEAK_CHANGE_AMPLITUDE = 0.5; // Коэффициент амплитуды изменений при утечке газа
const RANDOM_CHANGE_AMPLITUDE = 20; // Коэффициент амплитуды случайных изменений уровня газа
const MAX_CHANGE_STEP = 3; // Максимальный шаг изменения уровня газа за одну итерацию

// Константы для диапазонов уровней газа
const MAX_LEVEL = 100; // Максимально возможный уровень газа
const MIN_LEVEL = 0; // Минимально возможный уровень газа

// Инициализация датчиков
const sensors = Array.from({ length: 10 }, (_, i) => ({
	id: `sensor-${i + 1}`, // Уникальный идентификатор датчика
	level: Math.random() * 15, // Начальный уровень газа (от 0 до 15%)
	name: `Датчик ${i + 1}`, // Имя датчика
	logs: [], // Журнал изменений уровня газа
	gasLeakDetected: false, // Флаг обнаружения утечки газа
	gasLeakStartTime: null, // Время начала утечки газа
}));

// Вероятности изменения уровня газа
const probabilities = [0.9, 0.05, 0.03, 0.015, 0.005]; // Сумма вероятностей должна быть равна 1

// Классы для визуального обозначения статусов уровней газа
const statusClasses = [
	'status-green',
	'status-yellow',
	'status-orange',
	'status-burgundy',
	'status-purple',
];

// Подписи для каждого из статусов уровня газа
const statusLabels = [
	'Норма',
	'Незначительное отклонение',
	'Отклонение от нормы',
	'Большое отклонение',
	'Критическое отклонение',
];

// Глобальные переменные для работы с таймером оповещения
let globalLog = []; // Глобальный журнал всех изменений
let timer = null; // Таймер для отсчета времени до вызова МЧС
let countdownTime = 10; // Время до вызова МЧС (в секундах)
let mcCalled = false; // Флаг, сигнализирующий о том, что МЧС уже вызвано

// Инициализация страницы при загрузке
window.onload = function () {
	const sensorContainer = document.getElementById('sensors');
	sensors.forEach(sensor => {
		const sensorElement = document.createElement('div');
		sensorElement.id = sensor.id;
		sensorElement.classList.add('sensor-card');
		sensorElement.onclick = () => openModal(sensor); // Открытие модального окна для конкретного датчика
		sensorContainer.appendChild(sensorElement);
	});
	updateSensors(); // Первоначальное обновление уровней датчиков
	setInterval(updateSensors, 1000); // Запуск обновления уровней датчиков каждую секунду
};

// Функция обновления уровня газа для всех датчиков
function updateSensors() {
	sensors.forEach(sensor => {
		sensor.level = generateLevel(sensor); // Генерация нового уровня газа для датчика
		const sensorElement = document.getElementById(sensor.id);
		const statusClass = getStatusClass(sensor.level);
		sensorElement.innerHTML = `
			<h3>${sensor.name}</h3>
			<p>Уровень: <strong>${sensor.level.toFixed(2)}%</strong></p>
			<div class="status ${statusClass}">${getStatusLabel(sensor.level)}</div>
		`;
		if (sensor.level > 20) logEvent(sensor); // Логирование события, если уровень превышает 20%

		if (sensor.level > 40 && !sensor.gasLeakDetected) {
			sensor.gasLeakDetected = true; // Установка флага утечки газа
			sensor.gasLeakStartTime = Date.now(); // Запись времени начала утечки
			startGasLeakAlert(sensor); // Запуск оповещения о газовой утечке
		}
	});
}

// Генерация нового уровня газа для датчика
function generateLevel(sensor) {
	if (sensor.gasLeakDetected) {
		// Увеличение уровня при утечке газа
		let change =
			(Math.random() * GAS_LEAK_CHANGE_AMPLITUDE * 2 -
				GAS_LEAK_CHANGE_AMPLITUDE) *
			10;
		return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, sensor.level + change));
	}

	const random = Math.random();
	let cumulative = 0;
	for (let i = 0; i < probabilities.length; i++) {
		cumulative += probabilities[i];
		if (random < cumulative) {
			let change =
				(Math.random() * RANDOM_CHANGE_AMPLITUDE * 2 -
					RANDOM_CHANGE_AMPLITUDE) *
				10;
			let newLevel = Math.max(
				MIN_LEVEL,
				Math.min(MAX_LEVEL, sensor.level + change)
			);
			if (Math.abs(newLevel - sensor.level) > MAX_CHANGE_STEP) {
				newLevel =
					sensor.level +
					(newLevel > sensor.level ? MAX_CHANGE_STEP : -MAX_CHANGE_STEP);
			}
			return newLevel;
		}
	}
	return sensor.level; // Уровень не изменяется
}

// Определение класса статуса на основе уровня газа
function getStatusClass(level) {
	if (level <= 20) return 'status-green';
	if (level <= 40) return 'status-yellow';
	if (level <= 60) return 'status-orange';
	if (level <= 80) return 'status-burgundy';
	return 'status-purple';
}

// Получение метки статуса по уровню газа
function getStatusLabel(level) {
	return statusLabels[Math.min(Math.floor(level / 20), 4)];
}

// Логирование события изменения уровня газа
function logEvent(sensor) {
	const timestamp = new Date().toLocaleTimeString();
	const logEntry = {
		entry: `<div class="log-entry"><span class="${getStatusClass(
			sensor.level
		)}">${getStatusLabel(sensor.level)}</span> <span>${timestamp} - ${
			sensor.name
		}: уровень ${sensor.level.toFixed(2)}%</span></div>`,
		level: sensor.level,
		timestamp,
	};
	sensor.logs.push(logEntry); // Добавление записи в журнал датчика
	globalLog.push(logEntry); // Добавление записи в глобальный журнал
	globalLog.sort(compareLogEntries); // Сортировка журнала по уровню и времени
	updateGlobalLog(); // Обновление интерфейса глобального журнала
}

// Сравнение записей журнала по уровню и времени
function compareLogEntries(a, b) {
	if (a.level !== b.level) return b.level - a.level;
	return new Date(b.timestamp) - new Date(a.timestamp);
}

// Обновление глобального журнала в интерфейсе
function updateGlobalLog() {
	const logContainer = document.getElementById('global-log');
	logContainer.innerHTML = `${globalLog.map(log => log.entry).join('')}`;
}

// Открытие модального окна для датчика
function openModal(sensor) {
	const modal = document.getElementById('modal');
	const logContainer = document.getElementById('sensor-log-container');
	const sortedLogs = sensor.logs.sort(compareLogEntries);
	logContainer.innerHTML = `<h2>Журнал событий ${sensor.name}</h2>${sortedLogs
		.map(log => log.entry)
		.join('')}`;
	modal.style.display = 'flex';
}

// Закрытие модального окна
function closeModal() {
	document.getElementById('modal').style.display = 'none';
}

// Запуск оповещения об утечке газа
function startGasLeakAlert(sensor) {
	if (mcCalled) return; // Если МЧС уже вызвано, повторный вызов не выполняется
	const alertContainer = document.getElementById('alert');
	const countdownContainer = document.getElementById('countdown');
	alertContainer.style.display = 'block';
	alertContainer.innerHTML = 'Тревога! Утечка газа обнаружена!';
	countdownContainer.style.display = 'block';

	countdownTime = 10;
	timer = setInterval(() => {
		if (countdownTime <= 0) {
			clearInterval(timer);
			countdownContainer.style.display = 'none';
			alertContainer.innerHTML = 'Оповещение МЧС! Утечка газа подтверждена!';
			mcCalled = true;
		} else {
			countdownContainer.innerText = `Осталось ${countdownTime} секунд до вызова МЧС`;
			countdownTime--;
		}
	}, 1000);
}
