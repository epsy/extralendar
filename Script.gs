// -------------------------- CONST ----------------------------

var LOG_LEVEL = 1;
var ADDRESS = "";
var USERNAME = "";
var PASSWORD = "";
var CALENDAR = "";
var STEP = 14;

// for error loggin purpose
var EMAIL = "";
var SHEET_ID = "";


// -------------------------- Main ----------------------------

function main(){
  var cal = CalendarApp.getCalendarById(CALENDAR);

  var dateNow = roundDate( new Date() );
  log(2, dateNow);
  var dateNext = roundDate( dateAddDay( new Date(), STEP ) );
  log(2, dateNext);

  var cookies = doLogin();

  resetCalendar(cal, dateNow, dateNext);

  var calendarInfo = fetchExtranet(cookies, dateNow, dateNext);
  calendarInfo = JSON.parse(calendarInfo);

  for(i in calendarInfo){
    createEvent(cal,calendarInfo[i]);
  }
}

// Login the user with its credentials
function doLogin(){
  var base_cookie = makeHttpRequest(ADDRESS,{}).getAllHeaders()['Set-Cookie'].split(';')[0];
  log( 2, base_cookie, "Base Cookie");

  var url = ADDRESS+'/Users/Account/DoLogin';
  var payload =  {
    'username' : USERNAME,
    'password' : PASSWORD
  };

  var headers = {
    'accept' : '*/*',
    'Connection' :	'keep-alive',
    'Referer' : ADDRESS,
    'User-Agent' :	'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:32.0) Gecko/20100101 Firefox/32.0',
    'Cookie' : base_cookie,
  };

  var options = {
    'method': 'POST',
    'headers': headers,
    'payload' : payload,
    'followRedirects' : false
  };

  var response = makeHttpRequest(url, options);
  log( 2, response.getAllHeaders()['Set-Cookie'].split(';')[0], "Response Code");

  var returnValue = [ base_cookie, response.getAllHeaders()['Set-Cookie'].split(';')[0]];

  return returnValue;
}

// Fetch the extranet calendar
function fetchExtranet(cookies, dateNow, dateNext){
  var headers = {
    'Cookie' : cookies.join(';')
  }
  var url = ADDRESS+'/Student/Calendar/GetStudentEvents?start='+ generateTimestamp( dateNow ) +'&end='+ generateTimestamp( dateNext );

  var options = {
    'method': 'get',
    'headers': headers,
  };
  var response = makeHttpRequest(url, options);

  return response;
}


// -------------------------- HTTP Request ----------------------------

function makeHttpRequest( url, options ){
  logRequest( 3, url, options );
  var response = UrlFetchApp.fetch(url, options);  //https://developers.google.com/apps-script/reference/url-fetch/http-response#getAllHeaders()
  log( 3, response.getResponseCode(), "Response Code");

  return response;
}

function parseTitle(title){
  Logger.log(title);
  var regexp = "(.*) - (.*) - (.*)";
  var d = title.match(new RegExp(regexp));
  return {
    title : d[1],
    teacher : d[2],
    location : d[3]
  }
}

// -------------------------- Log Helpers ----------------------------

// Basic log
function log( level, message, header){
  if( level <= LOG_LEVEL ){
    if( header != null ){
      Logger.log( "-----> " + header );
    }
    Logger.log( message );
  }
}

// Debug request viewer
function logRequest( level, url, options){
  if( level <= LOG_LEVEL ){
    var result = UrlFetchApp.getRequest(url, options);

    for(i in result) {
      if(i == "headers"){
        for(j in result[i]) {
          Logger.log(i+" -> "+j + ": " + result[i][j]);
        }
      }
      else
        Logger.log(i + ": " + result[i]);
    }
  }
}

// -------------------------- Google Calendar helpers ----------------------------

// Create Event
function createEvent(calendar, event) {
  var info = parseTitle(event.title);
  Logger.log(info);
  var title = info.title;
  var start = new Date(getDateFromIso(event.start));
  var end = new Date(getDateFromIso(event.end));
  var desc = info.teacher;
  var loc = info.location;

  var event = calendar.createEvent(title, start, end, {
    description : desc,
    location : loc
  });
};

// reset the calendar between the two dates
function resetCalendar(calendar,date1, date2){
  var events = calendar.getEvents(date1, date2);
  for(var i in events){
    events[i].deleteEvent();
  }
}

// -------------------------- Error Report ----------------------------
function mailError(error){
	MailApp.sendEmail(EMAIL, "Error report",
			"\r\nMessage: " + e.message
			+ "\r\nFile: " + e.fileName
			+ "\r\nLine: " + e.lineNumber);
}

function sheetError(error){
	var errorSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Errors');
	lastRow = errorSheet.getLastRow();
	var cell = errorSheet.getRange('A1');
	cell.offset(lastRow, 0).setValue(e.message);
	cell.offset(lastRow, 1).setValue(e.fileName);
	cell.offset(lastRow, 2).setValue(e.lineNumber);
}
// -------------------------- Date helpers ----------------------------

// Round the current date to 00:00
function roundDate( pDate ){
  pDate.setHours(0);
  pDate.setMinutes(0);
  pDate.setSeconds(0);

  return pDate;
}

// Add the given number of days to the date
function dateAddDay( pDate, pDay ){
  pDate.setDate( pDate.getDate() + pDay );

  return pDate;
}

// Generate timestamp in the unix format
function generateTimestamp( pDate ){
  return pDate.getTime() / 1000 ;
}

// http://stackoverflow.com/questions/11810441/how-do-i-format-this-date-string-so-that-google-scripts-recognizes-it
// http://delete.me.uk/2005/03/iso8601.html
function getDateFromIso(string) {
  try{
    var aDate = new Date();
    var regexp = "([0-9]{4})(-([0-9]{2})(-([0-9]{2})" +
      "(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?" +
        "(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?";
    var d = string.match(new RegExp(regexp));

    var offset = 0;
    var date = new Date(d[1], 0, 1);

    if (d[3]) { date.setMonth(d[3] - 1); }
    if (d[5]) { date.setDate(d[5]); }
    if (d[7]) { date.setHours(d[7]); }
    if (d[8]) { date.setMinutes(d[8]); }
    if (d[10]) { date.setSeconds(d[10]); }
    if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
    if (d[14]) {
      offset = (Number(d[16]) * 60) + Number(d[17]);
      offset *= ((d[15] == '-') ? 1 : -1);
    }

    offset -= date.getTimezoneOffset();
    time = (Number(date) + (offset * 60 * 1000));
    return aDate.setTime(Number(time));
  } catch(e){
    return;
  }
}
