console.log('I AM POP UP');

function setUserInfo(sessionInfo){
    console.debug("[setUserInfo]: sessionInfo: ", sessionInfo);
    $(".hello_message").attr("hidden", true);

    $(".user_full_name").attr("hidden", false)
        .html(`Hello ${sessionInfo.userName}`);
    $(".user_id").attr("hidden", false)
        .html(`(Endomondo user id: ${sessionInfo.userId})`);

    setDownloadProgress(sessionInfo);
}


function setDownloadProgress(sessionInfo) {
    if(sessionInfo.totalWorkouts) {
        $(".total_number_missing").attr("hidden", true);
        $(".total_number").attr("hidden", false)
            .html(`Total Workouts Found: <b>${sessionInfo.totalWorkouts}</b><br/>`)

        $(".download_progress_3").html(`* Total files to be downloaded: <b>${2 * sessionInfo.totalWorkouts}</b><br/>each workout will be exported twice: 1 tcx file + 1 gpx file`);

        if (sessionInfo.currFile === 2 * sessionInfo.totalWorkouts){
            $("#download_all").prop('disabled', false);
            $(".download_progress_1").html(`Download Progress: <b>${sessionInfo.currFile}/${2 * sessionInfo.totalWorkouts}</b> *<br/>`);
        } else if(sessionInfo.currFile > -1){
            $("#download_all").prop('disabled', true);
            $(".download_progress_1").html(`Download Progress: <b>${sessionInfo.currFile}/${2 * sessionInfo.totalWorkouts}</b> *<br/>`);
        } else if(sessionInfo.totalWorkouts > 0) {
            $("#download_all").prop('disabled', false);
        }

    } else {
        $(".total_number_missing").attr("hidden", false)
            .html('Total workouts are being processed...');
    }
}

function clearDownloadProgress(){
    $(".download_progress_1").html("");
    $(".download_progress_2").html("");
    $(".download_progress_3").html("");
}

function clearUserInfo(){
    console.debug("[clearUserInfo]");

    $(".hello_message").attr("hidden", false);
    $(".user_full_name").attr("hidden", true).html("");
    $(".user_id").attr("hidden", false).html("");
    $("#download_all").prop('disabled', true);
    $(".total_number").attr("hidden", true).html("");
    $(".total_number_missing").attr("hidden", false);
}


const endomondoRE = /^https:\/\/www\.endomondo/;
let popupSessionInfo = {};

function updatePopupView(){
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        // Only on endomondo pages:
        if(endomondoRE.test(tabs[0].url)){
            chrome.runtime.sendMessage({action: "bg.get_session_info"}, response => {
                if (response && response.sessionInfo && response.sessionInfo.loggedIn){
                    popupSessionInfo = response.sessionInfo;
                    console.debug("[bg.get_session_info]: got session info: ", popupSessionInfo);
                    setUserInfo(popupSessionInfo);
                } else {
                    clearUserInfo();
                }
            });
        }
    })
}

function updatePopupTimer(millis){
        try{
            updatePopupView();
            setTimeout(updatePopupTimer, millis);
        } catch (e) {
            console.warn("updatePopup got an exception: ", e);
        }
}

updatePopupTimer(200);

/* Event Handlers */
$(document).on('click', '#download_all', (e) => {
    console.log("'Downloading all' was clicked");

    clearDownloadProgress();

    // get XMLS from content
    chrome.runtime.sendMessage({action: "start_download_workouts"}, response => {
        console.log("start_download_workouts response => ", response);
    })

    // send a download order to background
    console.log("'Downloading all' was clicked");
})