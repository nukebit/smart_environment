export type Gebouw = { id: number; naam: string };
export type Lokaal = { id: number; naam: string; gebouwId: number; gebouw: string; temperatureMinimum: number; temperatureMaximum: number; humidityMinimum: number; humidityMaximum: number; pressureMinimum: number; pressureMaximum: number };
