import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { vi } from 'vitest';

describe('App', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const isGeocoding = String(input).includes('geocoding-api');
      const body = isGeocoding
        ? {
            results: [{
              name: 'Chennai',
              country: 'India',
              latitude: 13.08,
              longitude: 80.27,
              timezone: 'Asia/Kolkata'
            }]
          }
        : {
            current: {
              temperature_2m: 30,
              relative_humidity_2m: 70,
              apparent_temperature: 34,
              is_day: 1,
              precipitation: 0,
              weather_code: 1,
              wind_speed_10m: 10,
              time: '2026-10-24T12:00'
            },
            daily: {
              time: ['2026-10-24'],
              weather_code: [1],
              temperature_2m_max: [32],
              temperature_2m_min: [25],
              sunrise: ['2026-10-24T06:00'],
              sunset: ['2026-10-24T18:00']
            }
          };
      return {
        ok: true,
        json: async () => body
      } as Response;
    }));

    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the weather dashboard title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Find your');
  });

  it('should convert temperatures when switching units', () => {
    const app = new App();
    expect(app.displayTemperature(20)).toBe(20);
    app.toggleUnit();
    expect(app.displayTemperature(20)).toBe(68);
  });
});
