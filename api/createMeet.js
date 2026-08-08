import { verifyUser, friendlyDriveErrorMessage, getCalendarClient } from "./_driveClient.js";

export default async function handler(req, res) {
  try {
    await verifyUser(req);
    
    let summary, description, startTime, endTime, attendees;
    if (req.method === "POST" && req.body) {
      ({ summary, description, startTime, endTime, attendees } = req.body);
    }

    const calendar = getCalendarClient();
    
    const requestId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

    const event = {
      summary: summary || "Tago Life Portal Meeting",
      description: description || "Scheduled via Tago Life Portal",
      start: {
        dateTime: startTime || new Date().toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endTime || new Date(Date.now() + 3600000).toISOString(),
        timeZone: "UTC",
      },
      conferenceData: {
        createRequest: {
          requestId: requestId,
          conferenceSolutionKey: {
            type: "hangoutsMeet"
          }
        }
      },
      attendees: attendees ? attendees.map(email => ({ email })) : []
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: event,
    });

    const hangoutLink = response.data.hangoutLink;
    
    if (!hangoutLink) {
      throw new Error("Failed to generate Google Meet link. Please ensure your Google account supports Google Meet.");
    }

    res.status(200).json({ hangoutLink, meetLink: hangoutLink, eventId: response.data.id });
  } catch (err) {
    console.error("createMeet error:", err);
    res.status(err.status || 500).json({ error: friendlyDriveErrorMessage(err) });
  }
}
