const winston = require('winston');

const axios = require('axios')
const FormData = require('form-data');
const cheerio = require('cheerio');

const datefns = require('date-fns')

const notifier = require('node-notifier');

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers')

const config = require('./config.json');

async function sendQuery(queryDate){
  
  logger.verbose("Query Date: " + queryDate.toDateString());

  const formattedDate = datefns.format(queryDate, "yyyy-MM-dd");
  var formData = new FormData();

  formData.append("fctrl_1", "offering_guid");
  formData.append("offering_guid", config.offeringGuid);

  formData.append("fctrl_4", "show_date");
  formData.append("show_date", formattedDate);

  try{

    const response = await axios.post(config.url, formData, {
      headers: formData.getHeaders()
    })
    
    let parsedResults = parseResponse(response.data)
    return parsedResults;
  }
  catch(error){
    logger.error(error)
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

function showNotification(str) {
  logger.info(str);

  let now = new Date();
  if((now - lastNotificationDate) > notificationInterval) {
    notifier.notify({
      title: 'Booking',
      message: str
    });

    lastNotificationDate = now;
  }
}

async function update(queryDate, queryHours){

  logger.verbose("Update for date: " + queryDate);

  const result = await sendQuery(queryDate);
  
  if(result)
  {
    for(i in queryHours)
    {
      const hour = queryHours[i];
      logger.verbose("Hour " + hour);
    
      if(hour in result)
      {   
        slots = result[hour].slots;
        
        if(slots > 0) {
          let notifStr = "Slot found for date: " + queryDate.toDateString() + " " + hour + ":00";
          showNotification(notifStr);
        }
        else
        {
          logger.info("No free slot found for date: " + queryDate.toDateString() + " " + hour + ":00");
        }
      }
      else  {
        logger.warn("No slot exists for date: " + queryDate.toDateString() + " " + hour + ":00");
      }
    }
  }

  updateTimeout = setTimeout(update.bind(null, queryDate, queryHours), updateInterval);
}

async function main(){

  logger.info("Date: " + queryDate.toString());
  logger.info("Hours: " + queryHours);

  await update(queryDate, queryHours);
}

const argv = yargs(hideBin(process.argv))
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    default: false
  })
  .option('date', {
    alias: 'd',
    type: 'string',
    description: 'Day to poll for',
    default: new Date().toDateString()
  })
  .option('times', {
    alias: 't',
    type: 'array',
    description: 'Hour times to poll for',
    default: config.times
  })
  .option('updateinterval', {
    alias: 'u',
    type: 'number',
    description: 'Update interval in seconds',
    default: config.updateInterval
  })
  .option('notificationinterval', {
    alias: 'n',
    type: 'number',
    description: 'Notification timeout in seconds',
    default: config.notificationInterval
  })
.argv

const queryDate = new Date(argv.date);
const queryHours = argv.times;

const notificationInterval = argv.updateinterval * 1000;
const updateInterval = argv.updateinterval * 1000;

var updateTimeout = null;
var lastNotificationDate = new Date(0);

const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({ level: argv.verbose ? 'verbose' : 'info' })
  ]
});

main()