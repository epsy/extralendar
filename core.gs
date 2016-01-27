// script that will be fetched automaticly by main.gs
// this script contains all the logic but no user information

function core(){
	try {
		coreFunction();
	} catch(e) {
		if(args.sheet_id !== undefined && args.sheet_id !== "")
			sheetError(e);

		if(args.email !== undefined && args.email !== "")
			mailError(e);

        log(2, e.stack, e);
	}
}

// -------------------------- Main ----------------------------
function coreFunction(){
  log(2, "Script started at " + new Date());
  if( !checkArguments() )
    throw error(10000, "One or more of the arguments is empty");

   var cal = CalendarApp.getCalendarById(args.calendar);

  if( cal === null )
    throw error(10001, "Please specify a valid calendar");

  if( args.step <= 0 )
    throw error(10002, "The step must be greater than zero");

  var dateNow = new Date();
  dateNow.setHours(0);
  dateNow.setMinutes(0);
  dateNow.setSeconds(0);
  var dateNext = new Date();
  dateNext.setDate(dateNext.getDate() + args.step);
  dateNext.setHours(23);
  dateNext.setMinutes(59);
  dateNext.setSeconds(59);
  log(2, "Fetchings events from " + dateNow + " to " + dateNext);

  var cookies = doLogin();

  var calendarInfo = fetchExtranet(cookies, dateNow, dateNext);

  if( calendarInfo === null )
    throw error(10003, "Something went wrong while fetching the calendar");

  calendarInfo = JSON.parse(calendarInfo);

  log(5, "getting existing events");
  var existing = cal.getEvents(dateNow, dateNext);
  log(5, "gotten existing events");
  var classes = {};

  var uid;

  for(var i in existing){
      var event = existing[i];
      uid = get_uid_from_cal(event);
      if(uid !== -1) {
          classes[uid] = event;
      }
      else if(args.delete_unknown) {
          log(5, "Deleting unmanaged event " + event.getTitle());
          event.deleteEvent();
      }
  }

  var new_events = [];
  var noLongerUsed = clone(existing);

  for(i in calendarInfo){
    try {
        var info = parseEvent(calendarInfo[i]);
        new_events.push(info);
        delete noLongerUsed[info.uid];
    } catch(e) {
        log( 1, e.stack, e );
    }
  }

  for(i in noLongerUsed) {
      new_events.push({
        deleteMe: true,
        uid: i,
        start: noLongerUsed[i].getStartTime()
      });
  }

  new_events.sort(function(a, b) {
    return a.start - b.start;
  });

  for(i in new_events){
    try {
        createOrUpdateEvent(cal, new_events[i], classes);
    } catch(e) {
        log( 1, e.stack, e );
        var msg = e.message;
        if(msg !== undefined) {
            if(msg.indexOf('in a short time') !== -1) {
                Utilities.sleep(1000);
                try {
                    createOrUpdateEvent(cal, new_events[i], classes);
                } catch(e) {
                    log( 1, e.stack, "Failed after retry: " + e.toString() );
                }
            }
        }
    }
  }

  doLogout();
}

// Login the user with its credentials
function doLogin(){
  var base = makeHttpRequest(args.address,{});

  if( base.getAllHeaders()['Set-Cookie'] === undefined || base.getAllHeaders()['Set-Cookie'].split("=")[0] != "ASP.NET_SessionId")
    throw error(10004, "Impossible to fetch the ASP id, check the ADDRESS");

  var base_cookie = base.getAllHeaders()['Set-Cookie'].split(';')[0];

  log( 2, base_cookie, "Base Cookie");

  var url = args.address+'/Users/Account/DoLogin';
  var payload =  {
    'username' : args.username,
    'password' : args.password
  };

  var headers = {
    'accept' : '*/*',
    'Connection' :	'keep-alive',
    'Referer' : args.address,
    'User-Agent' :	'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:32.0) Gecko/20100101 Firefox/32.0',
    'Cookie' : base_cookie,
  };

  var options = {
    'method': 'POST',
    'headers': headers,
    'payload' : payload,
  };

  var response = makeHttpRequest(url, options);

  if( response.getAllHeaders()['Set-Cookie'] === undefined || response.getAllHeaders()['Set-Cookie'].split("=")[0] != "extranet_db")
    throw error(10005, "Login error, please check your credentials");

  var returnValue = [ base_cookie, response.getAllHeaders()['Set-Cookie'].split(';')[0]];

  log( 2, returnValue[1], "Response Code");

  return returnValue;
}

// Close the session
function doLogout(){
  makeHttpRequest(args.address+"/Users/Account/ExtLogout",{});
  return;
}

// Fetch the extranet calendar
function fetchExtranet(cookies, dateNow, dateNext){
  var headers = {
    'Cookie' : cookies.join(';')
  };
  var url = args.address+'/Student/Calendar/GetStudentEvents?start='+ formatDate( dateNow ) +'&end='+ formatDate( dateNext );
    
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
  var parts = title.split(" - ");
  if(parts.length >= 3) {
      return {
          title: parts.slice(0, parts.length - 2).join(" - ").trim(' '),
          teacher: parts[parts.length - 2].trim(' '),
          location: parts[parts.length - 1].trim(' '),
      };
  }
  else if(parts.length == 2) {
      var teacher;
      var location;
      if(parts[1].indexOf(',') !== -1) {
          teacher = parts[1].trim(' ');
      }
      else
      {
          location = parts[1].trim(' ');
      }
      return {
          title: parts[0].trim(' '),
          teacher: teacher,
          location: location,
      };
  }
  return {
      title: parts[0],
      teacher: undefined,
      location: undefined,
  };
}

function addComputedFields(info) {
    info.description_field = info.teacher;
    info.title_field = info.title;
    if(args.override_location) {
        if(info.location !== undefined) {
            if(info.location.length < args.location_max_length) {
                info.title_field = info.location + ' - ' + info.title;
            } else {
                info.title_field = '\u2026 - ' + info.title;
                info.description_field = info.location + '\n\n' +
                                         info.description_field;
            }
        }
        info.location = args.override_location;
    }
    if(args.log_update) {
        info.description_field += "\n\nUpdated at :\n" + new Date();
    }

    var id = generate_id(info);
    info.uid = id[0];
    info.id = id;
}

function id_to_cookie(id) {
    return 'uid+' + id.join('.') + '@x-extranet-export';
}

function parseEvent(event) {
    var info = parseTitle(event.title);
    info.start_raw = event.start;
    info.start = new Date(getDateFromIso(event.start));
    info.end_raw = event.end;
    info.end = new Date(getDateFromIso(event.end));

    addComputedFields(info);

    return info;
}

function toalphanum(s) {
    return s.replace(/\W/g, '').toLowerCase();
}

function generate_id(info) {
    title = toalphanum(info.title);
    start = toalphanum(info.start_raw);
    return [
        title+start+args.invalidator, title, start,
        toalphanum(info.end_raw), toalphanum(info.teacher),
        toalphanum(info.location)
    ];
}

function id_to_uid(id) {
    return id.split('.', 1)[0].slice(4);
}

function get_id_from_cal(event) {
    var guest = get_guest_cookie_from_cal(event);
    if(guest === -1) return -1;
      return guest.getEmail().slice(0, -18);
}

function get_guest_cookie_from_cal(event) {
    var guests = event.getGuestList();
    for(var i in guests) {
        var guest = guests[i];
        if(guest.getEmail().slice(-18) === '@x-extranet-export')
            return guest;
    }
    return -1;
}

function get_uid_from_cal(event) {
    var id = get_id_from_cal(event);
    if(id === -1) return id;
    return id_to_uid(id);
}

// -------------------------- Log Helpers ----------------------------

// Basic log
function log( level, message, header){
  if( level <= args.log_level ){
    if( header !== undefined ){
      Logger.log( "-----> " + header );
    }
    Logger.log( message );
  }
}

// Debug request viewer
function logRequest( level, url, options){
  if( level <= args.log_level ){
    var result = UrlFetchApp.getRequest(url, options);

    for(var i in result) {
      if(i == "headers"){
        for(var j in result[i]) {
          Logger.log(i+" -> "+j + ": " + result[i][j]);
        }
      }
      else
        Logger.log(i + ": " + result[i]);
    }
  }
}

// -------------------------- Error Report ----------------------------

function mailError(error){
  MailApp.sendEmail(args.email, "Error report Extralendar",
                    "\r\nDate: " + new Date() +
                    "\r\nNumber: " + error.number +
                    "\r\nMessage: " + error.message +
                    "\r\nLine: " + error.lineNumber);
}

function sheetError(error){
  var errorSheet = SpreadsheetApp.openById(args.sheet_id).getSheetByName('Errors');
  lastRow = errorSheet.getLastRow();
  var cell = errorSheet.getRange('A1');
  cell.offset(lastRow, 0).setValue(new Date());
  cell.offset(lastRow, 1).setValue(error.number);
  cell.offset(lastRow, 2).setValue(error.message);
  cell.offset(lastRow, 3).setValue(error.lineNumber);
}

// -------------------------- Google Calendar helpers ----------------------------

function createOrUpdateEvent(calendar, info, classes) {
    var existing = classes[info.uid];
    if(info.deleteMe === true) {
        if(existing !== undefined) {
            log(5, info.uid, "Deleting removed event");
            existing.deleteEvent();
        }
    } else if(existing !== undefined) {
        log(5, info.uid, "Updating existing event");
        updateEvent(existing, info);
    }
    else {
        log(5, info.uid, "Creating new event");
        createEvent(calendar, info);
    }
}

// Create Event
function createEvent(calendar, info) {
  var desc = info.description_field + args.magic_line +
     "Write comments below the line. Anything above the line will be overwritten.\n\n";

  var event = calendar.createEvent(info.title_field, info.start, info.end, {
    description: desc,
    location: info.location,
    guests: id_to_cookie(info.id)
  });
}

function updateDescription(event, info) {
    var oldDesc = event.getDescription().split(args.magic_line);
    oldDesc[0] = info.description_field;
    event.setDescription(oldDesc.join(args.magic_line));
}

function updateEvent(event, info) {
    var guest = get_guest_cookie_from_cal(event);
    var id = guest.getEmail().slice(0, -18).split('.');

    var changed = false;
    var descChanged = false;

    if(id[1] !== info.id[1] || args.override_location && id[5] !== info.id[5])
    {
        log(5, id[1]+"!=="+info.id[1]+" || "+id[5]+"!=="+ info.id[5] +
            "\nNew value: " + info.title_field, "Title changed");
        event.setTitle(info.title_field);
        changed = true;
    }
    if(id[2] !== info.id[2] || id[3] !== info.id[3])
    {
        log(5, id[2]+"!=="+info.id[2]+" || "+id[3]+" !== "+info.id[3] +
            "\nNew value: " + info.start + " to " + info.end, "Time changed");
        event.setTime(info.start, info.end);
        changed = true;
    }
    if(id[4] !== info.id[4] ||
       args.override_location && id[5] !== info.id[5])
    {
        log(5, id[4]+"!=="+info.id[4]+" || "+id[5]+" !== "+info.id[5] +
            "\nNew value: " + info.description_field, "Description changed");
        updateDescription(event, info);
        changed = true;
        descChanged = true;
    } else if(args.log_update === "all") {
        log(1, "Changed update timestamp. Consider turning off" +
                "log_update: \"all\" to save on API requests.");
        updateDescription(event, info);
        descChanged = true;
    }
    if(!args.override_location && id[5] !== info.id[5])
    {
        log(5, id[5]+"!=="+info.id[5] + 
            "\nNew value: " + info.location, "Location changed");
        event.setLocation(indo.location);
        changed = true;
    }

    if(changed) {
        if(args.log_update && !args.log_update) {
            updateDescription(event, info);
        }
        var cookie = id_to_cookie(info.id);
        log(5, "Updating existing event cookie: " + cookie);
        event.removeGuest(guest.getEmail());
        event.addGuest(cookie);
    } else {
        log(5, "No changes");
    }
}


// reset the calendar between the two dates
function resetCalendar(calendar,date1, date2){
  var events = calendar.getEvents(date1, date2);
  for(var i in events){
    events[i].deleteEvent();
  }
}

// -------------------------- Date helpers ----------------------------

// Format the date for the extranet website: yyyy-mm-dd
function formatDate(pDate){
  return pDate.getFullYear() + '-' + (pDate.getMonth()+1) + '-' + pDate.getDate();
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

    time = (Number(date) + (offset * 60 * 1000));
    return aDate.setTime(Number(time));
  } catch(e){
    return;
  }
}

// -------------------------- Misc Helpers ----------------------------

function error(pNumber, pMessage){
  var tempError = new Error( pMessage );  // https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Error
  tempError.number = pNumber;
  return tempError;
}

function clone(obj) {
  var ret = {};
  for(var k in obj) {
      if(obj.hasOwnProperty(k)) {
          ret[k] = obj[k];
      }
  }
  return ret;
}

function default_value(arg_name, default_) {
    // sets args[arg_name] to default_ if left undefined by the user
    args[arg_name] = args[arg_name] === undefined ? default_ : args[arg_name];
}

function checkArguments(){
  // Check required arguments
  if( args.address === undefined || args.address === "" )
    return false;

  if( args.username === undefined || args.username === "" )
    return false;

  if( args.password === undefined || args.password === "" )
    return false;

  if( args.calendar === undefined || args.calendar === "" )
    return false;

  // Set default values
  default_value('log_level', 1);
  default_value('step', 90);
  default_value('anonymous_stats', false);

  default_value('email', '');
  default_value('sheet_id', '');
  default_value('log_update', false);

  default_value('delete_unknown', true);
  default_value('magic_line', "\n\n----------------------\n");
  default_value('invalidator', "");

  default_value('override_location', "");
  default_value('location_max_length', 15);
  return true;
}

// as this script will be executed as a function we need to execute core at the end ot the file
core();
