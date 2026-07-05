/**
 * Webアプリにアクセスした際の初期表示
 */
function doGet() {
    return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Google Calendar Sync')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ログインユーザーの全カレンダーと、それぞれの直近の予定を取得する
 */
function getCalendarData() {
    try {
        const now = new Date();
        const oneMonthLater = new Date();
        oneMonthLater.setMonth(now.getMonth() + 1);

        const allCalendars = CalendarApp.getAllCalendars();
        const result = {
            calendars: [],
            events: []
        };

        allCalendars.forEach(cal => {
            // カレンダー情報を追加
            result.calendars.push({
                id: cal.getId(),
                name: cal.getName(),
                color: cal.getColor(),
                isPrimary: cal.isMyPrimaryCalendar()
            });

            // そのカレンダーの予定を取得
            const events = cal.getEvents(now, oneMonthLater);
            events.forEach(event => {
                result.events.push({
                    calendarId: cal.getId(),
                    title: event.getTitle(),
                    start: event.getStartTime().toISOString(),
                    end: event.getEndTime().toISOString(),
                    location: event.getLocation()
                });
            });
        });

        return result;
    } catch (e) {
        console.error('Error fetching calendar data:', e);
        throw new Error('カレンダーデータの取得に失敗しました: ' + e.message);
    }
}

// 互換性のために残す
function getCalendarEvents() {
    return getCalendarData().events;
}

