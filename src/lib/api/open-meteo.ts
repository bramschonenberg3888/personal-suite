const BASE_URL = 'https://api.open-meteo.com/v1';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  admin1?: string; // State/province
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  isDay: boolean;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  windSpeedMax: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeed: number;
}

// WMO Weather interpretation codes
export const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: 'Clear sky', icon: 'sun' },
  1: { description: 'Mainly clear', icon: 'sun' },
  2: { description: 'Partly cloudy', icon: 'cloud-sun' },
  3: { description: 'Overcast', icon: 'cloud' },
  45: { description: 'Foggy', icon: 'cloud-fog' },
  48: { description: 'Depositing rime fog', icon: 'cloud-fog' },
  51: { description: 'Light drizzle', icon: 'cloud-drizzle' },
  53: { description: 'Moderate drizzle', icon: 'cloud-drizzle' },
  55: { description: 'Dense drizzle', icon: 'cloud-drizzle' },
  56: { description: 'Light freezing drizzle', icon: 'cloud-drizzle' },
  57: { description: 'Dense freezing drizzle', icon: 'cloud-drizzle' },
  61: { description: 'Slight rain', icon: 'cloud-rain' },
  63: { description: 'Moderate rain', icon: 'cloud-rain' },
  65: { description: 'Heavy rain', icon: 'cloud-rain' },
  66: { description: 'Light freezing rain', icon: 'cloud-rain' },
  67: { description: 'Heavy freezing rain', icon: 'cloud-rain' },
  71: { description: 'Slight snow', icon: 'snowflake' },
  73: { description: 'Moderate snow', icon: 'snowflake' },
  75: { description: 'Heavy snow', icon: 'snowflake' },
  77: { description: 'Snow grains', icon: 'snowflake' },
  80: { description: 'Slight rain showers', icon: 'cloud-rain' },
  81: { description: 'Moderate rain showers', icon: 'cloud-rain' },
  82: { description: 'Violent rain showers', icon: 'cloud-rain' },
  85: { description: 'Slight snow showers', icon: 'snowflake' },
  86: { description: 'Heavy snow showers', icon: 'snowflake' },
  95: { description: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { description: 'Thunderstorm with slight hail', icon: 'cloud-lightning' },
  99: { description: 'Thunderstorm with heavy hail', icon: 'cloud-lightning' },
};

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];

  const url = `${GEOCODING_URL}/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Geocoding error:', response.status);
      return [];
    }

    const data = await response.json();

    return (data.results || []).map(
      (r: any): GeocodingResult => ({
        id: r.id,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country,
        countryCode: r.country_code,
        admin1: r.admin1,
      })
    );
  } catch (error) {
    console.error('Geocoding search error:', error);
    return [];
  }
}

export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const url = `${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Weather API error:', response.status);
      return null;
    }

    const data = await response.json();
    const current = data.current;

    if (!current) return null;

    return {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      apparentTemperature: current.apparent_temperature,
      isDay: current.is_day === 1,
      precipitation: current.precipitation,
      weatherCode: current.weather_code,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
    };
  } catch (error) {
    console.error('Current weather error:', error);
    return null;
  }
}

export async function getDailyForecast(
  lat: number,
  lon: number,
  days = 7
): Promise<DailyForecast[]> {
  const url = `${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset,wind_speed_10m_max&timezone=auto&forecast_days=${days}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Forecast API error:', response.status);
      return [];
    }

    const data = await response.json();
    const daily = data.daily;

    if (!daily || !daily.time) return [];

    return daily.time.map(
      (date: string, i: number): DailyForecast => ({
        date,
        temperatureMax: daily.temperature_2m_max[i],
        temperatureMin: daily.temperature_2m_min[i],
        precipitationSum: daily.precipitation_sum[i],
        precipitationProbabilityMax: daily.precipitation_probability_max[i],
        weatherCode: daily.weather_code[i],
        sunrise: daily.sunrise[i],
        sunset: daily.sunset[i],
        windSpeedMax: daily.wind_speed_10m_max[i],
      })
    );
  } catch (error) {
    console.error('Daily forecast error:', error);
    return [];
  }
}

export async function getHourlyForecast(
  lat: number,
  lon: number,
  hours = 24
): Promise<HourlyForecast[]> {
  const url = `${BASE_URL}/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&timezone=auto&forecast_hours=${hours}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error('Hourly forecast API error:', response.status);
      return [];
    }

    const data = await response.json();
    const hourly = data.hourly;

    if (!hourly || !hourly.time) return [];

    return hourly.time.map(
      (time: string, i: number): HourlyForecast => ({
        time,
        temperature: hourly.temperature_2m[i],
        humidity: hourly.relative_humidity_2m[i],
        precipitationProbability: hourly.precipitation_probability[i],
        weatherCode: hourly.weather_code[i],
        windSpeed: hourly.wind_speed_10m[i],
      })
    );
  } catch (error) {
    console.error('Hourly forecast error:', error);
    return [];
  }
}
