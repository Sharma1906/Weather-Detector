import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Location {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface CurrentConditions {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  time: string;
}

interface DailyForecast {
  date: string;
  weather_code: number;
  temperature_2m_max: number;
  temperature_2m_min: number;
  sunrise: string;
  sunset: string;
}

interface WeatherData {
  location: Location & { localTime: string };
  current: CurrentConditions;
  daily: {
    sunrise: string[];
    sunset: string[];
  };
  forecast: DailyForecast[];
}

interface GeocodingResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

interface ForecastResponse {
  current?: CurrentConditions;
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
  };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  city = '';
  readonly unit = signal<'C' | 'F'>('C');
  readonly weather = signal<WeatherData | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    void this.loadCity('Chennai');
  }

  async searchCity(): Promise<void> {
    const query = this.city.trim();
    if (!query || this.loading()) return;
    this.error.set('');
    this.loading.set(true);

    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({
        name: query,
        count: '1',
        language: 'en',
        format: 'json'
      }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error('City search is temporarily unavailable. Please try again.');
      const result = await response.json() as GeocodingResponse;
      const place = result.results?.[0];

      if (!place) {
        this.error.set(`We couldn't find "${query}". Check the spelling and try again.`);
        return;
      }

      await this.loadWeather({
        name: place.name,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone
      });
      this.city = '';
    } catch (error) {
      this.error.set(error instanceof Error
        ? error.message
        : 'Something went wrong while searching. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  useMyLocation(): void {
    if (this.loading()) return;
    if (!navigator.geolocation) {
      this.error.set('Location detection is not supported by this browser.');
      return;
    }

    this.error.set('');
    this.loading.set(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await this.loadWeather({
            name: 'Your location',
            country: '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            timezone: 'auto'
          });
        } catch (error) {
          this.error.set(error instanceof Error
            ? error.message
            : 'Could not load weather for your location. Please try again.');
        } finally {
          this.loading.set(false);
        }
      },
      (error) => {
        this.loading.set(false);
        this.error.set(error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. Allow location access in your browser or search for a city.'
          : 'Could not detect your location. Please try again or search for a city.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  toggleUnit(): void {
    this.unit.update((unit) => unit === 'C' ? 'F' : 'C');
  }

  displayTemperature(celsius: number): number {
    return Math.round(this.unit() === 'C' ? celsius : (celsius * 9) / 5 + 32);
  }

  weatherDescription(code: number): string {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return ['Mainly clear', 'Partly cloudy', 'Overcast'][code - 1] ?? 'Cloudy';
    if (code <= 48) return code === 45 ? 'Fog' : 'Freezing fog';
    if (code <= 57) return code === 56 ? 'Freezing drizzle' : 'Drizzle';
    if (code <= 67) return code >= 66 ? 'Freezing rain' : 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown conditions';
  }

  weatherIcon(code: number, isDay: boolean | number): string {
    const daytime = isDay === true || isDay === 1;
    if (code === 0) return daytime ? '☀️' : '🌙';
    if (code <= 2) return daytime ? '🌤️' : '☁️';
    if (code <= 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 67 || (code >= 80 && code <= 82)) return '🌧️';
    if (code <= 77 || code <= 86) return '🌨️';
    if (code <= 99) return '⛈️';
    return '🌡️';
  }

  private async loadCity(name: string): Promise<void> {
    this.loading.set(true);
    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' }).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not load the default city weather.');
      const result = await response.json() as GeocodingResponse;
      const place = result.results?.[0];
      if (!place) throw new Error('Could not find the default city.');
      await this.loadWeather({
        name: place.name,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone
      });
    } catch (error) {
      this.error.set(error instanceof Error
        ? `${error.message} You can still search for a city.`
        : 'Could not load weather. Please search for a city.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadWeather(location: Location): Promise<void> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
      timezone: location.timezone,
      forecast_days: '7'
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather data is temporarily unavailable. Please try again.');
    const result = await response.json() as ForecastResponse;
    const current = result.current;
    const daily = result.daily;

    if (!current || !daily || daily.time.length === 0) {
      throw new Error('The weather service returned incomplete data. Please try again.');
    }

    this.weather.set({
      location: { ...location, localTime: current.time },
      current,
      daily: {
        sunrise: daily.sunrise,
        sunset: daily.sunset
      },
      forecast: daily.time.map((date, index) => ({
        date,
        weather_code: daily.weather_code[index],
        temperature_2m_max: daily.temperature_2m_max[index],
        temperature_2m_min: daily.temperature_2m_min[index],
        sunrise: daily.sunrise[index],
        sunset: daily.sunset[index]
      }))
    });
  }
}
