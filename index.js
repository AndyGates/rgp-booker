const axios = require('axios')
const FormData = require('form-data');
const cheerio = require('cheerio');
var datefns = require('date-fns')
const notifier = require('node-notifier');

async function sendQuery(queryDate){
  
  const formattedDate = datefns.format(queryDate, "yyyy-MM-dd");
  var formData = new FormData();

  formData.append("fctrl_1", "offering_guid");
  formData.append("offering_guid", "b41f7158c38e43f5adb1ee5b003e4bd5");

  formData.append("fctrl_4", "show_date");
  formData.append("show_date", formattedDate);

  try{

    const response = await axios.post('https://app.rockgympro.com/b/widget/?a=equery', formData, {
      headers: formData.getHeaders()
    })
    
    let parsedResults = parseResponse(response.data)
    return parsedResults;
  }
  catch{
    console.error(error)
  }
}

function parseResponse(data){
  const $ = cheerio.load(data.event_list_html)
  let t = $('#offering-page-select-events-table')

  let a = {}

  t.find("tr").each(function(i, row){
   
    let info = { slots : 0 }
    const tds = $(this).find("td")

    const timeCol = tds[0]
    const timeStr = $(timeCol).text().trim();
    const s = timeStr.split(" to  ")[0];
    const parsedTime = datefns.parse(s,'EEE, MMMM dd, h aaa', (new Date))

    let availabilityCol = tds[1]
    let isFull = $(availabilityCol).find(".offering-page-event-is-full").length > 0
    if(false == isFull)
    {
        let availabilityStr = $(availabilityCol).text().replace("Availability", "").trim();

        let numberPattern = /(?<spaces>\d) space[s]?/g;
        let availabilityResult = numberPattern.exec(availabilityStr);
        let availability = null != availabilityResult ? parseInt(availabilityResult.groups.spaces) : Number.MAX_VALUE;

        info.slots = availability;
    }

    info.time = parsedTime;
    a[info.time.getHours()] = info;

  })

  return a;
}

async function main(){
  await update(queryDate)
}

async function update(queryDate){

  console.log(queryDate);

  const result = await sendQuery(queryDate);
  slots = result[queryDate.getHours()].slots;
  
  if(slots > 0) {

    let notifStr = "Slot found for date: " + queryDate.toString();

    console.log(notifStr);

    let now = new Date();
    if((now - lastNotificationDate) > notificationInterval) {
      

      notifier.notify({
        title: 'Booking',
        message: notifStr
      });

      lastNotificationDate = now;
    }
  }
  else  {
    console.log("No slot found for date: " + queryDate.toString());
  }

  updateTimeout = setTimeout(update.bind(null, queryDate), updateInterval);
}

const args = process.argv.slice(2);

const queryDate = new Date(args[0]);
const notificationInterval = 10 * 60 * 1000;
const updateInterval = 60 * 1000;

var updateTimeout = null;
var lastNotificationDate = new Date(0);

main()