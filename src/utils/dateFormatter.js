import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import locale from 'dayjs/locale/az.js'

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("az");


function formatListingDate(date) {
  const now = dayjs().tz("Asia/Baku");
  const d = dayjs(date).tz("Asia/Baku");

  // Bu gün
  if (d.format("YYYY-MM-DD") === now.format("YYYY-MM-DD")) {
    return `Bu gün ${d.format("HH:mm")}`;
  }

  // Dünən
  if (
    d.add(1, "day").format("YYYY-MM-DD") === now.format("YYYY-MM-DD")
  ) {
    return `Dünən ${d.format("HH:mm")}`;
  }

  const str = d.format("D MMMM");
  return str.replace(/\p{L}/u, (c) => c.toUpperCase());
}


export {
  formatListingDate
}