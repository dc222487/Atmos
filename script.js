const apiKey = 'PBNRLCVS7V32FYUJSVRTS575T';
const form = document.getElementById('location-form');
const overlay = document.getElementById('weather-overlay');
const input = document.getElementById('location-input');
const suggestionsDiv = document.getElementById('suggestions');
const weatherDiv = document.getElementById('weather');
const loadingDiv = document.getElementById('loading');

const unit = detectUnit();
console.log('Detected unit:', unit);

function detectUnit() {
  const locale = navigator.language || navigator.userLanguage;
  const fahrenheitLocales = ['US', 'BS', 'BZ', 'KY', 'PW'];
  const region = locale.split('-')[1];
  if (region && fahrenheitLocales.includes(region.toUpperCase())) {
    return 'imperial';
  }
  return 'metric';
}


// Suggest cities — uses Open-Meteo free geocoding
async function fetchCitySuggestions(query) {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.results ? data.results.map(r => `${r.name}, ${r.country}`) : [];
}

input.addEventListener('input', async () => {
  const query = input.value.trim();
  if (query.length < 2) {
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.add('hidden');
    return;
  }

  const suggestions = await fetchCitySuggestions(query);
  if (suggestions.length > 0) {
    suggestionsDiv.innerHTML = suggestions.map(s => `<div>${s}</div>`).join('');
    suggestionsDiv.classList.remove('hidden');
  } else {
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.add('hidden');
  }
});

suggestionsDiv.addEventListener('click', (e) => {
  if (e.target.tagName === 'DIV') {
    input.value = e.target.textContent;
    suggestionsDiv.innerHTML = '';
    suggestionsDiv.classList.add('hidden');
  }
});

async function fetchWeather(location) {
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}?unitGroup=metric&key=${apiKey}&contentType=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }
  const data = await response.json();
  console.log('Raw data:', data);
  return data;
}

// Get outfit advice
function getOutfitAdvice(temp, conditions, wind) {
  let advice = '';

  if (temp < 5) {
    advice = "🥶 It's freezing! Wear a heavy coat, hat, and gloves.";
  } else if (temp < 15) {
    advice = "🧥 It's chilly. A jacket or sweater is a good idea.";
  } else if (temp < 25) {
    advice = "👕 Mild weather. Light layers are fine.";
  } else {
    advice = "🩳 It's warm! Shorts and a t-shirt are perfect.";
  }

  if (conditions.toLowerCase().includes('rain')) {
    advice += " ☔️ Don't forget an umbrella!";
  }

  if (wind > 20) {
    advice += " 💨 It's windy, wear something windproof.";
  }

  return advice;
}

// Find best hour today
function findBestHour(hours) {
  let bestHour = null;
  let score = -Infinity;

  hours.forEach(hour => {
    const temp = hour.temp;
    const precip = hour.precip;
    const wind = hour.windspeed;

    const hourScore = temp - (precip * 5) - (wind * 0.2);

    if (hourScore > score) {
      score = hourScore;
      bestHour = hour;
    }
  });

  return bestHour;
}

// Stargazing tip
function getStargazingTip(forecast) {
  const tonight = forecast[0]; // tonight's day
  if (tonight.conditions.toLowerCase().includes('clear')) {
    return "✨ Tonight looks clear — perfect for stargazing!";
  } else {
    return "🔭 Tonight might be cloudy — check again later.";
  }
}

// Set dynamic gradient background
function setBackground(condition) {
  document.body.className = ''; // clear existing
  clearOverlay();

   const cond = condition.toLowerCase();
  if (cond.includes('clear') || cond.includes('sunny')) {
    document.body.classList.add('sunny');
    addSunRays();
  } else if (cond.includes('rain') || cond.includes('showers')) {
    document.body.classList.add('rainy');
    overlay.classList.add('rain');
  } else if (cond.includes('cloud')) {
    document.body.classList.add('cloudy');
    overlay.classList.add('clouds');
  } else {
    document.body.classList.add('cloudy');
    overlay.classList.add('clouds');
  }
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
}


// Process weather data
function processWeatherData(data) {
  const current = data.currentConditions;
  const forecast = data.days.slice(1, 8).map(day => ({
    date: day.datetime,
    temp: day.temp,
     tempmax: day.tempmax,
    tempmin: day.tempmin,
    conditions: day.conditions,
    icon: day.icon
  }));

  const bestHour = findBestHour(data.days[0].hours);

  return {
    location: data.resolvedAddress,
    current: {
      temperature: current.temp,
      description: current.conditions,
      icon: current.icon,
      windSpeed: current.windspeed
    },
    forecast,
    bestHour
  };
}

// Display in DOM
function displayWeather(info) {
  const iconURL = (icon) =>
    `https://raw.githubusercontent.com/VisualCrossing/WeatherIcons/master/PNG/1st%20Set%20-%20Color/${icon}.png`;

  // Current
  let html = `
    <h2>${info.location}</h2>
    <p><strong>Current:</strong> ${info.current.temperature}°C — ${info.current.description}</p>
    ${info.current.icon ? `<img src="${iconURL(info.current.icon)}" alt="${info.current.description}" />` : ''}
  `;

  // Outfit
  const outfit = getOutfitAdvice(
    info.current.temperature,
    info.current.description,
    info.current.windSpeed
  );
  html += `<p><strong>What to wear:</strong> ${outfit}</p>`;

  // Best hour
  html += `<h3>Best Time To Go Outside</h3>
    <p>${info.bestHour.datetime} — ${info.bestHour.temp}°${unit === 'metric' ? 'C' : 'F'}, ${info.bestHour.conditions}</p>
  `;

  // Stargazing
  const stargazing = getStargazingTip(info.forecast);
  html += `<p><strong>Stargazing:</strong> ${stargazing}</p>`;

  // 7-day forecast
  html += `<h3>7-Day Forecast</h3><div class="forecast">`;
  info.forecast.forEach(day => {
    html += `
      <div class="day">
        <p>${formatDate(day.date)}</p>
        <p>${day.temp}°${unit === 'metric' ? 'C' : 'F'} — ${day.conditions}</p>
        ${day.icon ? `<img src="${iconURL(day.icon)}" alt="${day.conditions}" />` : ''}
      </div>
    `;
  });
  html += `</div>`;
  html += `<div id="weekly-vibe"></div>`;
  weatherDiv.innerHTML = html;
  const vibeText = getWeeklyVibe(info.forecast);
  document.getElementById("weekly-vibe").innerText = vibeText;
  

  // Apply background
  setBackground(info.current.description);
}

// Handle submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const location = input.value.trim();
  if (!location) return;

  weatherDiv.innerHTML = '';
  loadingDiv.classList.remove('hidden');
  suggestionsDiv.innerHTML = '';
  suggestionsDiv.classList.add('hidden');

  try {
    const rawData = await fetchWeather(location);
    const weatherInfo = processWeatherData(rawData);
    console.log('Processed data:', weatherInfo);
    displayWeather(weatherInfo);
  } catch (err) {
    weatherDiv.innerHTML = `<p>Error: ${err.message}</p>`;
  } finally {
    loadingDiv.classList.add('hidden');
  }
});

function getWeeklyVibe(forecast) {
  let totalTemp = 0;
  let rainyDays = 0;
  let sunnyDays = 0;
  let coldDays = 0;
  let hotDays = 0;

  forecast.forEach(day => {
    const avg = (day.tempmax + day.tempmin) / 2;
    totalTemp += avg;

    const icon = (day.icon || "").toLowerCase();

    if (icon.includes("rain") || icon.includes("showers")) rainyDays++;
    if (icon.includes("clear") || icon.includes("sunny")) sunnyDays++;
    if (avg < 10) coldDays++;
    if (avg > 32) hotDays++;
  });

  const avgTemp = totalTemp / forecast.length;

  // Vibe generation
  if (hotDays >= 4) {
    return "🔥 Floor is lava mode activated — hydrate and hide in the shade!";
  }

  if (coldDays >= 4) {
    return "🧊 Brrr... looks like blanket-and-cocoa weather all week.";
  }

  if (rainyDays >= 4) {
    return "🌧️ Duck mode: ON. Umbrella will be your best friend.";
  }

  if (sunnyDays >= 5) {
    return "🌞 Get those sunnies out — it's a golden week!";
  }

  if (avgTemp >= 25 && rainyDays === 0) {
    return "😎 It’s like summer decided to hang around. BBQ time?";
  }

  if (rainyDays > 2 && sunnyDays > 2) {
    return "🌦️ A rollercoaster of moods this week — Mother Nature’s playlist is on shuffle.";
  }

  // Random fallback if nothing fits well
  const randomVibes = [
    "🤔 Weather can't make up its mind — wear layers and hope for the best.",
    "🌈 Anything could happen this week. Could even snow. Or explode.",
    "🌀 Chaos weather incoming — embrace the uncertainty!"
  ];

  return randomVibes[Math.floor(Math.random() * randomVibes.length)];
}

const trailContainer = document.getElementById('mouse-trail-container');
const trailDots = [];
const numDots = 5;
const positions = Array(numDots).fill({ x: 0, y: 0 });

// Create dots and append them
for (let i = 0; i < numDots; i++) {
  const dot = document.createElement('div');
  dot.classList.add('trail-dot');
  trailContainer.appendChild(dot);
  trailDots.push(dot);
}

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateTrail() {
  // Move the first dot towards the mouse
  positions[0] = {
    x: positions[0].x + (mouseX - positions[0].x) * 0.3,
    y: positions[0].y + (mouseY - positions[0].y) * 0.3,
  };

  // Move subsequent dots towards the position of the previous dot
  for (let i = 1; i < numDots; i++) {
    positions[i] = {
      x: positions[i].x + (positions[i - 1].x - positions[i].x) * 0.3,
      y: positions[i].y + (positions[i - 1].y - positions[i].y) * 0.3,
    };
  }

  // Update dots position and size for a nice trailing scale effect
  trailDots.forEach((dot, i) => {
    const pos = positions[i];
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    // Scale dots smaller as they go back in the trail
    const scale = 1 - i * 0.15;
    dot.style.width = `${16 * scale}px`;
    dot.style.height = `${16 * scale}px`;
    dot.style.opacity = `${1 - i * 0.2}`;
  });

  requestAnimationFrame(animateTrail);
}

animateTrail();

function addSunRays() {
  const overlay = document.getElementById('weather-overlay');
  overlay.innerHTML = ''; // clear existing
  const rayCount = 12; // number of rays
  for (let i = 0; i < rayCount; i++) {
    const ray = document.createElement('div');
    ray.className = 'sunray';
    ray.style.transform = `rotate(${(360 / rayCount) * i}deg)`;
    overlay.appendChild(ray);
  }
  overlay.classList.add('sunrays-rotate');
}

function clearOverlay() {
  const overlay = document.getElementById('weather-overlay');
  overlay.innerHTML = '';
  overlay.className = '';
}
