﻿exports.newTradingBotProcessMainLoop = function newTradingBotProcessMainLoop(BOT) {

    let bot = BOT;
    const ROOT_DIR = './';

    const MODULE_NAME = "TradingBotProcessMainLoop";
    const FULL_LOG = true;

    let USER_BOT_MODULE;
    let COMMONS_MODULE;

    const EVENT_HANDLER_MODULE = require(ROOT_DIR + 'EventHandler');
    bot.eventHandler = EVENT_HANDLER_MODULE.newEventHandler();

    const DEBUG_MODULE = require(ROOT_DIR + 'DebugLog');
    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;
    logger.bot = bot;
    logger.forceLoopSplit = true;
    logger.initialize();

    let thisObject = {
        initialize: initialize,
        run: run
    };

    let processConfig;
    let cloudStorage;

    return thisObject;

    function initialize(pProcessConfig, callBackFunction) {

        try {
            if (FULL_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }

            processConfig = pProcessConfig;

            const BLOB_STORAGE = require(ROOT_DIR + 'BlobStorage');
            cloudStorage = BLOB_STORAGE.newBlobStorage(bot);

            cloudStorage.initialize("AAPlatform", onInizialized);

            function onInizialized(err) {

                if (FULL_LOG === true) { logger.write("[INFO] initialize -> onInizialized -> Entering function."); }

                if (err.result === global.DEFAULT_OK_RESPONSE.result) {

                    /* We needed the cloudStorage initialized for both requesting the bot source code and, later requesting the AACloud condig at ShallWeStop function. */

                    const CLOUD_REQUIRE = require(ROOT_DIR + 'CloudRequire');
                    let cloudRequire = CLOUD_REQUIRE.newCloudRequire(bot, DEBUG_MODULE);

                    cloudRequire.downloadBot(cloudStorage, pProcessConfig, onBotDownloaded);

                    function onBotDownloaded(err, pMODULE) {

                        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                            logger.write("[ERROR] initialize -> onInizialized -> onBotDownloaded -> err.message = " + err.message);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            return;
                        }

                        USER_BOT_MODULE = pMODULE;

                        cloudRequire.downloadCommons(cloudStorage, onCommonsDownloaded);

                        function onCommonsDownloaded(err, pMODULE) {

                            if (err.result !== global.DEFAULT_OK_RESPONSE.result) {

                                logger.write("[ERROR] initialize -> onInizialized -> onBotDownloaded -> onCommonsDownloaded -> err.message = " + err.message);
                                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                bot.eventHandler.raiseEvent("Loop Finished");
                                return;
                            }

                            COMMONS_MODULE = pMODULE;

                            callBackFunction(global.DEFAULT_OK_RESPONSE);
                        }
                    }

                } else {
                    logger.write("[ERROR] Root -> start -> getBotConfig -> onInizialized ->  err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                    bot.eventHandler.raiseEvent("Loop Finished");
                }
            }
        } catch (err) {
            logger.write("[ERROR] initialize -> err = " + err.message);
            bot.eventHandler.raiseEvent("Loop Finished");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function run(callBackFunction) {

        try {
            if (FULL_LOG === true) { logger.write("[INFO] run -> Entering function."); }

            loop();

            function loop() {

                try {
                    bot.loopCounter++;

                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Entering function."); }

                    /* We define here all the modules that the rest of the infraestructure, including the bots themselves can consume. */

                    const UTILITIES = require(ROOT_DIR + 'CloudUtilities');
                    const BLOB_STORAGE = require(ROOT_DIR + 'BlobStorage');
                    const DEBUG_MODULE = require(ROOT_DIR + 'DebugLog');
                    const POLONIEX_CLIENT_MODULE = require(ROOT_DIR + 'PoloniexAPIClient');
                    const EXCHANGE_API = require(ROOT_DIR + 'ExchangeAPI');
                    const CONTEXT = require(ROOT_DIR + 'Context');
                    const ASSISTANT = require(ROOT_DIR + 'Assistant');
                    const STATUS_REPORT = require(ROOT_DIR + 'StatusReport');
                    const DATA_SET = require(ROOT_DIR + 'DataSet');
                    const STATUS_DEPENDENCIES = require(ROOT_DIR + 'StatusDependencies');
                    const DATA_DEPENDENCIES = require(ROOT_DIR + 'DataDependencies');

                    /* Waitime Variable */

                    let nextWaitTime;

                    /* We define the datetime for the process that we are running now. This will be the official processing time for both the infraestructure and the bot. */

                    switch (bot.runMode) {
                        case 'Live': {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Live Mode detected."); }

                            // This will be considered the process date and time, so as to have it consistenly all over the execution.

                            let localDate = new Date();

                            bot.processDatetime = new Date(Date.UTC(
                                localDate.getUTCFullYear(),
                                localDate.getUTCMonth(),
                                localDate.getUTCDate(),
                                localDate.getUTCHours(),
                                localDate.getUTCMinutes(),
                                localDate.getUTCSeconds(),
                                localDate.getUTCMilliseconds()));
                            break;
                        }
                        case 'Backtest': {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Backtesting Mode detected."); }

                            if (bot.hasTheBotJustStarted === true) {

                                if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Setting initial datetime."); }

                                bot.processDatetime = new Date(bot.backtest.beginDatetime); // Set the starting time as the configured beginDatetime.   

                            } else {

                                bot.processDatetime = new Date(bot.processDatetime.valueOf() + 60000); // We advance one minute in time. 

                                let endDatetime = new Date(bot.backtest.endDatetime);

                                if (bot.processDatetime.valueOf() > endDatetime.valueOf()) {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> End of Backtesting Period reached. Exiting Bot Process Loop."); }

                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                                    return;
                                }
                            }
                            break;
                        }
                        case 'Competition': {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Competition Mode detected."); }

                            let localDate = new Date();

                            bot.processDatetime = new Date(Date.UTC(
                                localDate.getUTCFullYear(),
                                localDate.getUTCMonth(),
                                localDate.getUTCDate(),
                                localDate.getUTCHours(),
                                localDate.getUTCMinutes(),
                                localDate.getUTCSeconds(),
                                localDate.getUTCMilliseconds()));

                            let beginDatetime = new Date(bot.competition.beginDatetime);

                            if (bot.processDatetime.valueOf() < beginDatetime.valueOf()) {

                                if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> Competition not started yet. Wainting for the competition to start."); }

                                nextWaitTime = 'Normal';
                                loopControl(nextWaitTime);
                                return;
                            }

                            let endDatetime = new Date(bot.competition.endDatetime);

                            if (bot.processDatetime.valueOf() > endDatetime.valueOf()) {

                                if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> End of Competition Period reached. Exiting Bot Process Loop."); }

                                bot.eventHandler.raiseEvent("Loop Finished");
                                callBackFunction(global.DEFAULT_OK_RESPONSE);
                                return;
                            }

                            break;
                        }
                        default: {
                            logger.write("[ERROR] run -> loop -> Unexpected bot.runMode.");
                            logger.write("[ERROR] run -> loop -> bot.runMode = " + bot.runMode);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            return;
                        }
                    }

                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> bot.processDatetime = " + bot.processDatetime); }
                  
                    /* We will prepare first the infraestructure needed for the bot to run. There are 3 modules we need to sucessfullly initialize first. */

                    let context;
                    let exchangeAPI;
                    let assistant;
                    let userBot;
                    let statusDependencies;
                    let dataDependencies;

                    initializeStatusDependencies();

                    function initializeStatusDependencies() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeStatusDependencies ->  Entering function."); }

                            statusDependencies = STATUS_DEPENDENCIES.newStatusDependencies(bot, DEBUG_MODULE, STATUS_REPORT, BLOB_STORAGE, UTILITIES);

                            statusDependencies.initialize(processConfig.statusDependencies, undefined, undefined, onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeStatusDependencies ->  onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeStatusDependencies -> onInizialized -> Execution finished well. :-)");
                                            initializeDataDependencies();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeStatusDependencies ->  onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeStatusDependencies -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function initializeDataDependencies() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeDataDependencies ->  Entering function."); }

                            dataDependencies = DATA_DEPENDENCIES.newDataDependencies(bot, DEBUG_MODULE, DATA_SET, BLOB_STORAGE, UTILITIES);

                            dataDependencies.initialize(processConfig.dataDependencies, onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeDataDependencies ->  onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeDataDependencies -> onInizialized -> Execution finished well. :-)");
                                            initializeContext();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeDataDependencies ->  onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeDataDependencies -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }
                    
                    function initializeContext() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeContext ->  Entering function."); }

                            context = CONTEXT.newContext(bot, DEBUG_MODULE, BLOB_STORAGE, UTILITIES, STATUS_REPORT);
                            context.initialize(statusDependencies, onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeContext ->  onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeContext -> onInizialized -> Execution finished well. :-)");
                                            initializeExchangeAPI();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeContext -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeContext -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeContext -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeContext -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeContext ->  onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeContext -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function initializeExchangeAPI() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeExchangeAPI ->  Entering function."); }

                            exchangeAPI = EXCHANGE_API.newExchangeAPI(bot, DEBUG_MODULE, POLONIEX_CLIENT_MODULE);

                            exchangeAPI.initialize(onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeContext ->  onInizialized -> onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeExchangeAPI -> onInizialized -> Execution finished well. :-)");
                                            initializeAssistant();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeExchangeAPI -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeExchangeAPI -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeExchangeAPI -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeExchangeAPI -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeContext ->  onInizialized -> onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeExchangeAPI -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function initializeAssistant() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeAssistant ->  Entering function."); }

                            assistant = ASSISTANT.newAssistant(bot, DEBUG_MODULE, UTILITIES);
                            assistant.initialize(context, exchangeAPI, dataDependencies, onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeAssistant -> onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeAssistant -> onInizialized -> Execution finished well. :-)");
                                            initializeUserBot();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeAssistant -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeAssistant -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeAssistant -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeAssistant -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeAssistant -> onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeAssistant -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function initializeUserBot() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeUserBot ->  Entering function."); }

                            usertBot = USER_BOT_MODULE.newUserBot(bot, DEBUG_MODULE, COMMONS_MODULE);

                            usertBot.initialize(assistant, onInizialized);

                            function onInizialized(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> initializeUserBot -> onInizialized -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> initializeUserBot -> onInizialized -> Execution finished well. :-)");
                                            startUserBot();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> initializeUserBot -> onInizialized -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> initializeUserBot -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function startUserBot() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> startUserBot ->  Entering function."); }

                            usertBot.start(onFinished);

                            function onFinished(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> startUserBot -> onFinished -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> startUserBot -> onFinished -> Execution finished well. :-)");
                                            saveContext();
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> startUserBot -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> startUserBot -> onFinished -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> startUserBot -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> startUserBot -> onFinished -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> startUserBot -> onFinished -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> startUserBot -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                    function saveContext() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> saveContext ->  Entering function."); }

                            context.saveThemAll(onFinished);

                            function onFinished(err) {

                                try {

                                    if (FULL_LOG === true) { logger.write("[INFO] run -> loop -> saveContext -> onFinished -> Entering function."); }

                                    switch (err.result) {
                                        case global.DEFAULT_OK_RESPONSE.result: {
                                            logger.write("[INFO] run -> loop -> saveContext -> onFinished -> Execution finished well. :-)");
                                            nextWaitTime = 'Normal';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write("[ERROR] run -> loop -> saveContext -> onFinished -> Can not retry at this point.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write("[ERROR] run -> loop -> saveContext -> onFinished -> Operation Failed. Aborting the process.");
                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(err);
                                            return;
                                        }
                                        default: {
                                            logger.write("[ERROR] run -> loop -> saveContext -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write("[ERROR] run -> loop -> saveContext -> onFinished -> Unhandled err.result received. -> err.message = " + err.message);

                                            bot.eventHandler.raiseEvent("Loop Finished");
                                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                                            return;
                                        }
                                    }

                                } catch (err) {
                                    logger.write("[ERROR] run -> loop -> saveContext -> onFinished -> err = " + err.message);
                                    bot.eventHandler.raiseEvent("Loop Finished");
                                    callBackFunction(err);
                                }
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loop -> saveContext -> err = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(err);
                        }
                    }

                } catch (err) {
                    logger.write("[ERROR] run -> loop -> err = " + err.message);
                    bot.eventHandler.raiseEvent("Loop Finished");
                    callBackFunction(err);
                }
            }

            function loopControl(nextWaitTime) {

                if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> nextWaitTime = " + nextWaitTime); }

                /* Here we check if we must stop the loop gracefully. */

                shallWeStop(onStop, onContinue);

                function onStop() {

                    if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> Stopping the Loop Gracefully. See you next time! :-)"); }
                    bot.eventHandler.raiseEvent("Loop Finished");
                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                    return;

                }

                function onContinue() {

                    /* Trading bots are going to be executed after a configured period of time after the last execution ended. This is to avoid overlapping executions. */

                    switch (nextWaitTime) {
                        case 'Normal': {
                            if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> Restarting Loop in " + (processConfig.normalWaitTime / 1000) + " seconds."); }
                            bot.eventHandler.raiseEvent("Loop Finished");
                            setTimeout(loop, processConfig.normalWaitTime);
                        }
                            break;
                        case 'Retry': {
                            if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> Restarting Loop in " + (processConfig.retryWaitTime / 1000) + " seconds."); }
                            bot.eventHandler.raiseEvent("Loop Finished");
                            setTimeout(loop, processConfig.retryWaitTime);
                        }
                            break;
                        case 'Sleep': {
                            if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> Restarting Loop in " + (processConfig.sleepWaitTime / 60000) + " minutes."); }
                            bot.eventHandler.raiseEvent("Loop Finished");
                            setTimeout(loop, processConfig.sleepWaitTime);
                        }
                            break;
                        case 'Coma': {
                            if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> Restarting Loop in " + (processConfig.comaWaitTime / 3600000) + " hours."); }
                            bot.eventHandler.raiseEvent("Loop Finished");
                            setTimeout(loop, processConfig.comaWaitTime);
                        }
                            break;
                    }
                }
            }

            function shallWeStop(stopCallBack, continueCallBack) {

                try {
                    if (FULL_LOG === true) { logger.write("[INFO] run -> loopControl -> shallWeStop -> Entering function. "); }

                    let filePath = "AdvancedAlgos" + "/" + "AACloud";
                    let fileName = "this.config.json";

                    cloudStorage.getTextFile(filePath, fileName, onFileReceived);

                    function onFileReceived(err, text) {

                        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                            logger.write("[ERROR] run -> loopControl -> shallWeStop -> onFileReceived -> err.message = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            return;
                        }

                        try {

                            let configRead = JSON.parse(text);

                            if (configRead.stopGracefully === false) {
                                continueCallBack();
                            } else {
                                stopCallBack();
                            }

                        } catch (err) {
                            logger.write("[ERROR] run -> loopControl -> shallWeStop -> onFileReceived -> err.message = " + err.message);
                            bot.eventHandler.raiseEvent("Loop Finished");
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            return;
                        }
                    }
                }
                catch (err) {
                    logger.write("[ERROR] run -> loopControl -> shallWeStop -> err.message = " + err.message);
                    bot.eventHandler.raiseEvent("Loop Finished");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                    return;
                }
            }
        }

        catch (err) {
            logger.write("[ERROR] run -> err = " + err.message);
            bot.eventHandler.raiseEvent("Loop Finished");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};
