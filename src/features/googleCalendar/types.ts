export interface GoogleCalendarEventDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GoogleCalendarEvent {
  kind?: string
  id: string
  status?: string
  summary?: string
  description?: string
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
  htmlLink?: string
  etag?: string
  extendedProperties?: {
    private?: Record<string, string>
    shared?: Record<string, string>
  }
}

export interface GoogleCalendarEventInput {
  summary: string
  description?: string
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
  extendedProperties?: {
    private?: Record<string, string>
  }
}

export interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  timeZone?: string
}
