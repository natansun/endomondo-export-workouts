console.log("my extension: from content script!");
chrome.runtime.sendMessage({action: "page_reload" });

function getSessionInfo(sessionInfo){
    let profileInfo = document.getElementsByClassName("header-member-profile-name")[0];
    sessionInfo.loggedIn = true;

    if(profileInfo){
        sessionInfo.userId = profileInfo.href.split('/').pop();
        sessionInfo.userName = profileInfo.innerText;
        sessionInfo.loggedIn = true;
        // console.log('found profile info by method 1');
    } else {
        profileInfo = $(".headerRightContent");
        if(profileInfo && profileInfo.length){
            profileInfo = profileInfo.find("a[href*='profile']")[0];
            sessionInfo.userId = profileInfo.href.split('/').pop();
            sessionInfo.userName = profileInfo.innerText;
            sessionInfo.loggedIn = true;
            // console.log('found profile info by method 2');
        } else {
            sessionInfo.loggedIn = false;
        }
    }

    console.debug("[getSessionInfo] search for session info in dom: ", sessionInfo);
    return sessionInfo;
}

function updateSessionInfo(sessionInfo, config){
    getSessionInfo(sessionInfo);
    if(sessionInfo.loggedIn){
        config.sessionInfoTimer = 60000;
        console.debug(`set config.sessionInfoTimer to ${config.sessionInfoTimer} millis`);
    }
    setTimeout(updateSessionInfo, config.totalWorkoutTimer, sessionInfo, config);
}

async function getWorkout(limit, userId){
    const userErrMsg = "Endomondo Workouts Downloader Extension:\n" +
        "Download failed, please refresh the page, and try again";

    if(!userId){
        console.warn("can't get workouts for userId: ", userId);
        return {};
    }
    let response = await fetch("https://www.endomondo.com/rest/v1/users/" + userId + "/workouts/history?limit=" + limit + "&expand=workout%3Afull", {})
        .catch((error) => {
            console.error("catch error: " , error);
            // Your error is here!
            alert(userErrMsg);
            chrome.runtime.sendMessage({action: "page_reload" });
            throw new Error("[getWorkout] Bad response from server");
        });

    if (response.status >= 400 && response.status < 600) {
        console.error("response error code: " , response.status);
        alert(userErrMsg);
        chrome.runtime.sendMessage({action: "page_reload" });
        throw new Error("[getWorkout] Bad response from server");
    }

    return await response.json();
}

async function getTotalWorkouts(sessionInfo){
    let res = await getWorkout(1, sessionInfo.userId);
    let total = undefined;
    if(res && res.paging){
        sessionInfo.totalWorkouts = res.paging.total;
        console.debug("[getTotalWorkouts]: get total workouts: ", sessionInfo.totalWorkouts);
        total = sessionInfo.totalWorkouts;
    }
    return total;
}

async function updateTotalWorkouts(sessionInfo, config){
    try{
        if(sessionInfo && sessionInfo.loggedIn){
            sessionInfo.totalWorkouts = await getTotalWorkouts(sessionInfo);
            console.debug("sessionInfo.totalWorkouts: ", sessionInfo.totalWorkouts);
            if(sessionInfo.totalWorkouts){
                config.totalWorkoutTimer = 60000;
                console.debug(`set config.totalWorkoutTimer to ${config.totalWorkoutTimer} millis`);
            }
        } else {
            delete(sessionInfo.totalWorkouts);
        }
    } catch (e) {
        // clearInterval(totalWorkoutsTimeout);
        console.error("[totalWorkoutsTimeout2] getTotalWorkouts got an error: ", e);
    }

    setTimeout(updateTotalWorkouts, config.totalWorkoutTimer, sessionInfo, config);
}

let sessionInfo = {};

(async function() {
    const messageTag = "Message";
    const pictureTag = "Picture";
    const picturesTag = "Pictures";

    let downloadInterval;
    let config = {
        totalWorkoutTimer: 1000,
        sessionInfoTimer: 1000
    };

    updateSessionInfo(sessionInfo, config)
    updateTotalWorkouts(sessionInfo, config);

    async function getWorkoutsRaw(totalWorkouts, userId) {
        return await getWorkout(totalWorkouts, userId);
    }

    /**
     * Endomondo uses the start_time value as the file name, after the following format:
     *
     * strat_time: "2020-11-18T14:46:05.000Z"   =>   exported file name: 20201118_144605
     */
    function formatStartTime(start_time) {
        try {
            return start_time.split(".")[0].replace(/[-|:]/g, "").replace("T", "_")
        } catch (e) {
            console.error("failed to format start_time to a file name");
            return start_time;
        }
    }

    function getWorkoutsInfo(workoutsRaw){
        if(workoutsRaw.data){
            console.log("Got " + workoutsRaw.data.length + " workouts !");
            return workoutsRaw.data.map(workout => {
                return {"id": workout.id,
                        "startTime": formatStartTime(workout.start_time),
                        "title": workout.title,
                        "message": workout.message,
                        "pictures": workout.pictures
                };
            });
        }
        return [];
    }

    async function getWorkoutXML(userId, workoutId, fileFormat){
        return await new Promise(resolve =>{
            let woURL = `https://www.endomondo.com/rest/v1/users/${userId}/workouts/${workoutId}/export?format=${fileFormat}`;
            let http = new XMLHttpRequest();

            http.open('GET', woURL, true);

            http.onreadystatechange = function() {//Call a function when the state changes.
                if(http.readyState === 4 && http.status === 200) {
                    let resp = http.responseText;
                    resolve(resp);
                }
            }

            http.send();
        })
    }

    function tagNameToExtend(fileFormat){
        let nodeToAppend;
        switch (fileFormat) {
            case "TCX":
                nodeToAppend = "Activity";
                break;
            case "GPX":
                nodeToAppend = "trk";
                break;
        }

        return nodeToAppend;
    }

    function elementToExtend(xmlDoc, tagName) {
        if(tagName){
            const elements = xmlDoc.getElementsByTagName(tagName);
            return elements[0];
        }
        return xmlDoc.children[0];
    }

    function extendXmlString(xmlString, nodeTag, nodeData, fileFormat){
        // const xmlString = res;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml")
        let newElem;

        switch (nodeTag) {
            case messageTag:
                newElem = xmlDoc.createElement(messageTag);
                newElem.innerHTML = nodeData;
                break;

            case picturesTag:
                newElem = xmlDoc.createElement(picturesTag);
                nodeData.map(picture => {
                    let pictureNode = xmlDoc.createElement(pictureTag);
                    pictureNode.setAttribute('id', picture.id)
                    pictureNode.setAttribute('picture_token', picture.picture_token)
                    pictureNode.setAttribute('url', picture.url)

                    newElem.appendChild(pictureNode);
                })
                break;
        }

        let tagName = tagNameToExtend(fileFormat)
        let elemToExtend = elementToExtend(xmlDoc, tagName);
        elemToExtend.appendChild(newElem);

        xmlString = new XMLSerializer().serializeToString(xmlDoc);
        return xmlString;
    }

    /**
     *
     * @param workoutsInfo contains both workout id and workout start time
     * @param userId the user id
     * @param fileFormats
     *
     * Download every couple of seconds several workouts (not all at once).
     */
    function paginateWorkouts(workoutsInfo, userId, fileFormats=["TCX","GPX"]){
        let offset = 0;
        let pageSize = 4;
        let total = workoutsInfo.length;

        console.log('set timer to get workouts');
        downloadInterval = setInterval(function(){
            console.log('my timer');
            for (let index = offset; index < offset + pageSize && index < total; index++) {
                let workoutId = workoutsInfo[index].id;
                let title = workoutsInfo[index].title;
                let startTime = workoutsInfo[index].startTime;
                let message = workoutsInfo[index].message;
                let pictures = workoutsInfo[index].pictures;

                for (let fileFormat of fileFormats){
                    // console.log('workout %d ID: %s (fileFormat: %s)', index + 1, workoutId, format);
                    getWorkoutXML(userId, workoutId, fileFormat).then(function(xmlString){
                        const msgPrefix = `workout ${index + 1} ID: ${workoutId} (format: ${fileFormat})`;
                        console.info(`${msgPrefix} -> send XML to background to download`);
                        if(message){
                            xmlString = extendXmlString(xmlString, messageTag, message, fileFormat);
                            console.debug(`${msgPrefix} -> contains a "message": ${message}`);
                        }

                        if(pictures.length > 0){
                            xmlString = extendXmlString(xmlString, picturesTag, pictures, fileFormat);
                            console.debug(`${msgPrefix} -> contains "pictures": ${JSON.stringify(pictures)}`);

                        }
                        chrome.runtime.sendMessage({action: "download_file", fileName: title || startTime, fileFormat: fileFormat , data: xmlString});
                    });
                }
            }
            offset += pageSize;
            if(offset >= total){
                console.log('clear timer to get workouts');
                clearInterval(downloadInterval);
                downloadInterval = undefined;
            }
        }, 2000 );
    }

    async function getAllWorkouts(totalWorkouts, userId, fileFormats=["TCX","GPX"]){
        let wosRaw = await getWorkoutsRaw(totalWorkouts, userId);
        let wosInfo = getWorkoutsInfo(wosRaw);
        console.info("workouts info to be downloaded: ", wosInfo);
        paginateWorkouts(wosInfo, userId, fileFormats);
    }

    chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
        // console.debug("got action: ", request.action);

        if(request.action === "content.get_session_info") {
            sendResponse({sessionInfo: sessionInfo});
            return;
        }

        if(request.action === "get_xmls_from_content"){
            getAllWorkouts(request.totalWorkouts, request.userId, ["TCX", "GPX"]);
            return true;
        }

        console.warn("[content onMessage] - not handled action: ", request.action)
    });

})();