// ------------------------------- EXTRALENDAR ----------------------------------------
//
//  Google Apps Script for the automatic export of compatible extranet websites
//  to a Google calendar.
//
//  To install, simply follow the instructions within.
//
//  Use GitHub for help/bugs/ideas:
//      https://github.com/epsy/extralendar/issues
//
// ------------------------------------------------------------------------------------

// PART 1: Copy this file to a new Google Apps Script
//  1. Go to https://script.google.com/
//  2. If prompted, click Start Scripting, then create a Blank Project.
//  3. Delete any code in the editor window that has just opened.
//  4. Copy-paste the contents of this file into the editor window.
//  5. Save the file using the menu or Ctrl+S
//
//
// PART 2: Creating a calendar for this script to operate in
//  1. Go to https://calendar.google.com/
//  2. In the sidebar on the left, click the boxed arrow near "My Calendars",
//     and click "Create new calendar".
//  3. This is the calendar that will contain all your events from the extranet
//     website. Pick an appropriate name for it then click "Create Calendar"
//     near the top/bottom of the page.
//  4. You are back to the main calendar view. After a few seconds, the new
//     calendar will show up in the sidebar. Hover over it with your mouse
//     pointer then hit the boxed arrow next to it. In that menu, click
//     "Calendar settings".
//  5. Use your browser's "Find in page" function (Ctrl+F) to find
//     "Calendar ID" in the page.
//  6. Copy the associated value. It should look something like like:
//     "6si31o3m3abf5c6ce2726o3qto@group.calendar.google.com"

var args = {

// PART 3: Script settings

//  1. The ID of the calendar this script will operate in.
//     Paste the Calendar ID within the quotes below.
    calendar: "",

// 2. The address of the extranet website. Probably looks like
//    "https://extranet.example.com/".
    address: "",

// 3. The username used for this website.
    username: "",

// 4. The password used for this website.
    password: "",

// 5. (Optional) How many days ahead should be synchornized?
    step: 14,

// 6. (Optional) If the setting below is empty, the room number in each event
//    will be assigned in the "Location" field of the event in your calendar.
//    If you prefer to have something else in that field (for instance a real
//    location, so that your phone may remind you when you should leave to
//    arrive on time), insert it below. The room number will be put in the
//    title of the event instead.
    override_location : "",
};

// PART 4: Automatically running the script.
//  1. Save this file using the menu or Ctrl+S.
//  2. In the "Resources" menu, click "Current project's triggers".
//  3. Use the link to add a new trigger.
//  4. I suggest setting it to run on a Day timer between 1:00 AM and 2:00 AM.
//  5. Allow the app through the ensuing authorization process.
//  6. Finally, to run the script immediately, open the "Run" menu and
//     click "main".
//
//
//
// You're all done! :-)
//
//

// Request authorization for calendar, docs and mail
CalendarApp.getColor();
MailApp.getRemainingDailyQuota();
SpreadsheetApp.flush();

function main(){
  var url = "https://raw.githubusercontent.com/epsy/extralendar/"+((args.branch!="develop") ? "master" : "develop") +"/core.gs";
  var core_gs = UrlFetchApp.fetch(url);
  var core = new Function(core_gs); // jshint ignore:line
  core();
}
