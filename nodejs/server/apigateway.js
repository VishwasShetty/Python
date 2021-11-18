const express = require('express')
const app = express();
const url = require('url');
const bodyParser = require('body-parser');
const mongoClient = require('mongodb').MongoClient;
var cors = require('cors');
var jwt = require('jsonwebtoken');
var md5 = require('md5');
const crypto = require("crypto");
const fs = require('fs')
const iot = require('aws-iot-device-sdk')
require('dotenv').config()
const geolib = require('geolib');

const mongoDBUri = process.env.URI;
const dbName = process.env.DB;

const ABLY_API_KEY = '6wKG3A.3ZC-BQ:DFXhv8_G8NNmtSJF'
const Ably = require('ably')
const ably = new Ably.Realtime(ABLY_API_KEY)
const orderUpdateEvent = 'order-update' //publish from apigateway to App
const serverManageApiGatewayChannel = 'service_manager-api_gateway'
const operatorApigateway = 'customer-location-update'
const OrderCancelEvent = 'order-cancel'
const broadCastEvent = 'broadcast-event'
const orderEvent = 'order-event'

 
// let iotServerThingPrivateKeyContent = fs.readFileSync('../certificates/privateKeyCertificate.pem.key').toString('base64')
// let iotServerThinClientKeyContent = fs.readFileSync('../certificates/clientCertificate.pem.crt').toString('base64')
// let iotServerThingCAContent = fs.readFileSync('../certificates/caCertificate.pem').toString('base64')

let publishTopic = ""

//iot thing which represents the server 
let iotServerThing;
const iotServerThingEndPoint = process.env.SERVER_THING_ENDPOINT;

//s3 image upload
const productBucket="mouvit-product-images-bucket1";
const idProofBucket="mouvit-idproof-images-bucket1";
const firmwareBucket="mouvit-firmware-file-bucket2";
const multer = require('multer');
const AWS = require('aws-sdk')
const storage = multer.memoryStorage();
const multiUpload = multer({ storage: storage });
const singleUpload=multer({ storage: storage });
const s3Id='AKIAQAH4H6IHNTXPU6V2';
const s3Secret='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';
const s3bucket = new AWS.S3({
    accessKeyId: s3Id,
    secretAccessKey: s3Secret,
  });

//stripe
const keySecret = process.env.STRIPE_SECRET_KEY; // enter the secret here
const stripe = require("stripe")(keySecret);
var currentUser;

//twilio
var accountSid = 'AC5e495cae993a527e952dc669303848cd'; // Your Account SID from www.twilio.com/console
// var accountSid = 'AC60db1b727b35bd029dec62b8326ba9b2'; // Your Account SID from www.twilio.com/console
var authToken = '6b73c48ee957d5103c5145a53b21eff8';   // Your Auth Token from www.twilio.com/console
// var authToken = 'f49f1773193039b95f6aaba77d3290f0';   // Your Auth Token from www.twilio.com/console
var twilioClient = require('twilio')(accountSid, authToken);

// Goole
const NodeGeocoder = require('node-geocoder');
const { resolve } = require('path');
const { rejects } = require('assert');
const GOOGLE_API_KEY = 'AIzaSyAAGoERGMD4jmfXDiDDtWU9xyyp-Xh7N6I'
const options = {
  provider: 'google',
  apiKey: GOOGLE_API_KEY, // for Mapquest, OpenCage, Google Premier
  formatter: null // 'gpx', 'string', ...
}
const geocoder = NodeGeocoder(options)

function initialize() {
    const uri = mongoDBUri;
    // const uri = "mongodb+srv://mouvitDBUser:welcomeMouvit@cluster0.99iux.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
    const client = new mongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    client.connect(err => {
        if (err) {
            console.log("error");
            console.log(err);
            client.close();
        } else {
            console.log("connected to db ");
            app.use(cors());
            app.use(bodyParser.urlencoded({ limit: '50mb',extended: false }));
            app.use(bodyParser.json({limit: '50mb'}));
            const botCollection = client.db(dbName).collection("bot");
            const appsCollection = client.db(dbName).collection("apps");
            const productsCollection = client.db(dbName).collection("products");
            const serviceproviderCollection = client.db(dbName).collection("service-provider");
            const remoteoperatorCollection = client.db(dbName).collection("remote-operator");
            const maintenanceinfoCollection = client.db(dbName).collection("maintenance-info");
            const chargingstationsCollection = client.db(dbName).collection("charging-stations");
            const mobilityDeviceReportCollection = client.db(dbName).collection("mobility-device-report");
            const serviceProviderOperation = client.db(dbName).collection("service-provider-operation-report");
            const userCollection = client.db(dbName).collection("user");
            const mapsCollection = client.db(dbName).collection("realtime-map");
            const inventoryCollection=client.db(dbName).collection("inventory");
            const firmwareCollection=client.db(dbName).collection("firmware");
            //app collections
            const otpCollection = client.db(dbName).collection("otp");
            const customerCollection = client.db(dbName).collection("customer");
            const orderCollection = client.db(dbName).collection("order");
            const messageCollection= client.db(dbName).collection("message");
            const rolesCollection = client.db(dbName).collection("roles");


            const listenToServiceManageChannel = ably.channels.get(serverManageApiGatewayChannel)
            //listen to service Manages broadcast message
            listenToServiceManageChannel.subscribe(orderEvent,function(message){
                if(Object.keys(message).length !==0){
                    handleUpdateOrderStatus(message.data,orderCollection)
                }
            })

            app.post('/mouvit/login', function (req, res) {
                console.log(req.body)
                handleLogin(req.body, res, userCollection,rolesCollection);
            });

            app.get('/mouvit/roles/search',authenticateJWT,function(req,res){
                handleSearchForRoles(req,res,rolesCollection);
            });

            app.post('/mouvit/bot/create', authenticateJWT, function (req, res) {
                handleCreateForBot(req.body, res, botCollection,appsCollection);
            });

            app.put('/mouvit/bot/update', authenticateJWT, function (req, res) {
                handleUpdateForBot(req.body, res, botCollection,appsCollection);
            });

            app.get('/mouvit/bot/show', authenticateJWT, function (req, res) {
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if(results.length > 0) {
                            if(results[0].role === "Service Provider"){
                                req.query.service_provider = results[0].associated_service_provider;
                                handleShowForBot(req, res, botCollection);
                            }
                            else{
                                handleShowForBot(req, res, botCollection);
                            }
                        }
                        else{
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 403;
                            res.json({ "response_desc": "Forbidden" });
                       }
                    });
            });

            app.get('/mouvit/bot/read', authenticateJWT, function (req, res) {
                handleReadForBot(req.query.botId, res, botCollection);
            });
            app.delete('/mouvit/bot/delete', authenticateJWT, function (req, res) {
                handleDeleteforBot(req.query.id, res, botCollection);
            });
            app.get('/mouvit/bot/search', authenticateJWT, function (req, res) {
                handleSearchForBots(req, res, botCollection);
            })

            app.post('/mouvit/apps/create', authenticateJWT, function (req, res) {
                handleCreateForApps(req.body, res, appsCollection);
            });
            app.put('/mouvit/apps/update', authenticateJWT, function (req, res) {
                handleUpdateForApps(req.body, res, appsCollection);
            });
            app.get('/mouvit/applications/show', authenticateJWT, function (req, res) {
                handleShowForApps(req, res, appsCollection);
            });
            app.get('/mouvit/apps/read', authenticateJWT, function (req, res) {
                handleReadForApps(req.query.appsId, res, appsCollection);
            });
            app.delete('/mouvit/applications/delete', authenticateJWT, function (req, res) {
                handleDeleteforApps(req.query.id, res, appsCollection);
            });
            app.post('/mouvit/products/create', authenticateJWT, function (req, res) {
                handleCreateForProducts(req.body, res, productsCollection);
            });
            app.put('/mouvit/products/update', authenticateJWT, function (req, res) {
                handleUpdateForProducts(req.body, res, productsCollection);
            });
            app.get('/mouvit/products/show', authenticateJWT, function (req, res) {
                handleShowForProducts(req, res, productsCollection);
            });
            app.get('/mouvit/products/read', authenticateJWT, function (req, res) {
                handleReadForProducts(req.query.productsId, res, productsCollection);
            });
            app.delete('/mouvit/products/delete', authenticateJWT, function (req, res) {
                handleDeleteforProducts(req.query.id, res, productsCollection);
            });
            app.post('/mouvit/service-provider/create', authenticateJWT, function (req, res) {
                handleCreateForServiceProvider(req.body, res, serviceproviderCollection,mapsCollection);
            });

            app.put('/mouvit/service-provider/update', authenticateJWT, function (req, res) {
                handleUpdateForServiceProvider(req.body, res, serviceproviderCollection,mapsCollection);
            });

            app.get('/mouvit/service-provider/show', authenticateJWT, function (req, res) {
                handleShowForServiceProvider(req, res, serviceproviderCollection);
            });

            app.get('/mouvit/service-provider/read', authenticateJWT, function (req, res) {
                handleReadForServiceProvider(req.query.uniqueId, res, serviceproviderCollection);
            });
            app.delete('/mouvit/service-provider/delete', authenticateJWT, function (req, res) {
                handleDeleteforServiceProvider(req.query.id, res, serviceproviderCollection,mapsCollection);
            });
            app.post('/mouvit/remote-operator/create', authenticateJWT, function (req, res) {
                handleCreateForRemoteOperator(req.body, res, remoteoperatorCollection);
            });

            app.put('/mouvit/remote-operator/update', authenticateJWT, function (req, res) {
                handleUpdateForRemoteOperator(req.body, res, remoteoperatorCollection);
            });

            app.get('/mouvit/remote-operator/show', authenticateJWT, function (req, res) {
                handleShowForRemoteOperator(req, res, remoteoperatorCollection);
            });

            app.get('/mouvit/remote-operator/read', authenticateJWT, function (req, res) {
                handleReadForRemoteOperator(req.query.uniqueId, res, remoteoperatorCollection);
            });
            app.delete('/mouvit/remote-operator/delete', authenticateJWT, function (req, res) {
                handleDeleteforRemoteOperator(req.query.id, res, remoteoperatorCollection);
            });

            app.post('/mouvit/maintenance-info/create', authenticateJWT, function (req, res) {
                handleCreateForMaintenanceInfo(req.body, res, maintenanceinfoCollection);
            });

            app.put('/mouvit/maintenance-info/update', authenticateJWT, function (req, res) {
                handleUpdateForMaintenanceInfo(req.body, res, maintenanceinfoCollection);
            });

            app.get('/mouvit/maintenance-info/show', authenticateJWT, function (req, res) {
                handleShowForMaintenanceInfo(req, res, maintenanceinfoCollection);
            });

            app.get('/mouvit/maintenance-info/read', authenticateJWT, function (req, res) {
                handleReadForMaintenanceInfo(req.query.id, res, maintenanceinfoCollection);
            });
            app.delete('/mouvit/maintenance-info/delete', authenticateJWT, function (req, res) {
                handleDeleteforMaintenanceInfo(req.query.id, res, maintenanceinfoCollection);
            });
            app.post('/mouvit/charging-stations/create', authenticateJWT, function (req, res) {
                handleCreateForChargingStations(req.body, res, chargingstationsCollection,mapsCollection);
            });

            app.put('/mouvit/charging-stations/update', authenticateJWT, function (req, res) {
                handleUpdateForChargingStations(req.body, res, chargingstationsCollection, mapsCollection);
            });

            app.get('/mouvit/charging-stations/show', authenticateJWT, function (req, res) {
                handleShowForChargingStations(req, res, chargingstationsCollection);
            });

            app.get('/mouvit/charging-stations/read', authenticateJWT, function (req, res) {
                handleReadForChargingStations(req.query.stationId, res, chargingstationsCollection);
            });
            app.delete('/mouvit/charging-stations/delete', authenticateJWT, function (req, res) {
                handleDeleteforChargingStations(req.query.id, res, chargingstationsCollection,mapsCollection);
            });

            app.get('/mouvit/dashboard', authenticateJWT, function (req, res) {
                handleDashboardGet(req.query, res,orderCollection,customerCollection,botCollection);
            });

            app.get('/mouvit/reporting/mobility-device-reporting', authenticateJWT, function (req, res) {
                handleReportingForMobiltyDevice(req, res, mobilityDeviceReportCollection);
            });
            app.get('/mouvit/reporting/service-provider-operation-reporting', authenticateJWT, function (req, res) {
                handleReportingForServiceProviderOperation(req, res, orderCollection,botCollection);
            });

            app.get('/mouvit/apps/search', authenticateJWT, function (req, res) {
                handleSearchForApps(req, res, appsCollection);
            });

            app.get('/mouvit/service-provider/search', authenticateJWT, function (req, res) {
                handleSearchForServiceProvider(req, res, serviceproviderCollection);
            });

            app.post('/mouvit/user/create', authenticateJWT, function (req, res) {
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleCreateForUser(req, res, userCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission denied" });
                            }
                        }
                    });
            });

            app.get('/mouvit/user/read', authenticateJWT, function (req, res) {
              handleReadForUser(req, res, userCollection);
            });

            app.put('/mouvit/user/update', authenticateJWT, function (req, res) {
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleUpdateForUser(req, res, userCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission denied" });
                            }
                        }
                    });
            });

            app.put('/mouvit/user/changepassword', authenticateJWT, function (req, res) {
                handleChangePassword(req,currentUser.username,res,userCollection);
            });
            app.delete('/mouvit/user/delete', authenticateJWT, function (req, res) {
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleDeleteForUser(req, res, userCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission denied" });
                            }
                        }
                    });
            });

            app.get('/mouvit/user/show', authenticateJWT, function (req, res) {
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleShowForUser(req, res, userCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission denied" });
                            }
                        }
                    });
            });
            
            app.get('/mouvit/static/realtime-map', authenticateJWT, function (req, res) {
                returnStaticMapCoordinates(res, mapsCollection);
            });
            app.get('/mouvit/dynamic/realtime-map', authenticateJWT, function (req,res){
                returnDynamicMapCoordinates(res, mapsCollection)
            })
            //inventory 
            app.post('/mouvit/inventory/create',authenticateJWT,async function(req,res){
                req.body.bot_id = Math.floor(Math.random() * 1000) + 1; 
                handleCreateInventory(req,res,inventoryCollection);                
            });  
            app.put("/mouvit/inventory/update",authenticateJWT,function(req,res){
                handleUpdateInventory(req,res,inventoryCollection);
            });
            app.get("/mouvit/inventory/show",authenticateJWT,function(req,res){
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if(results.length > 0) {
                            if (results[0].role === "Admin") {
                                handleShowInventory(req,res,inventoryCollection);
                            }
                            else if(results[0].role === "Service Provider"){
                                req.query.service_provider = results[0].associated_service_provider;
                                handleShowInventory(req,res,inventoryCollection);
                            }
                            else{
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission denied" });
                            }
                        }
                        else{
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 403;
                            res.json({ "response_desc": "Forbidden" });
                       }
                    });
            });
            app.get("/mouvit/inventory/:inventory_id",authenticateJWT,function(req,res){
                handleReadInventory(req.params.inventory_id,res,inventoryCollection);
            });
            app.delete("/mouvit/inventory/delete",authenticateJWT,function(req,res){
                handleDeleteInventory(req.query.id,res,inventoryCollection)
            });
            
            app.get('/mouvit/inventory/action/dooropen',authenticateJWT,function(req,res){
                    handleBotDoorOpen(req.query.bot_id,res);
            });

            //firmware
            app.post('/mouvit/firmware/create',authenticateJWT,function(req,res){
                handleCreateFirmware(req,res,firmwareCollection);
            });
            app.get('/mouvit/firmware/show',authenticateJWT,function(req,res){
                handleShowFirmware(req,res,firmwareCollection);
            });
            app.get('/mouvit/firmware/getlatest',authenticateJWT,function(req,res){
                handleGetLatestFirmware(req.query.firmware_type,res,firmwareCollection);
            });
            app.get('/mouvit/firmware/:firmware_id',authenticateJWT,function(req,res){
                handleReadFirmware(req.params.firmware_id,res,firmwareCollection);
            });
            app.delete('/mouvit/firmware/delete',authenticateJWT,function(req,res){
                handleDeleteFirmware(req.query.id,res,firmwareCollection);
            });
            //customer read from admin dashboard
            app.get('/mouvit/customers/read',authenticateJWT,function(req,res){
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleReadForCustomers(req.query.customer_id,res,customerCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission Denied" });
                            }
                        }
                    }).catch(error=>{
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.json({ "response_desc": "Internal Server Error" });     
                });
            })

                        //App 
            //otp paths
            app.post('/app/login/action/otprequest',function(req,res){
                handleOtpRequest(req.body.phone_number,res,otpCollection);
            });
            app.post('/app/login/action/otpverify',function(req,res){
                handleOtpVerify(req.body,res,otpCollection,customerCollection);
            });
            app.post('/app/login/action/otpresend',function(req,res){
                handleOtpRequest(req.body.phone_number,res,otpCollection);
            });
            //customer profile
            app.post('/app/profile/resource/customer/create',authenticateJWT,function(req,res){
                handleCreateCustomer(req.body,res,customerCollection);
            });
            app.put('/app/profile/resource/customer/:customer_id',authenticateJWT,function(req,res){
                handleUpdateCustomer(req,res,customerCollection);
            });
            
            app.get('/app/profile/resource/customer/:customer_id',authenticateJWT,function(req,res){
                handleReadCustomer(req.params.customer_id,res,customerCollection);
            });
            app.delete('/app/profile/resource/customer/:customer_id',authenticateJWT,function(req,res){
                handleDeleteCustomer(req.params.customer_id,res,customerCollection);
            });
            //admin path
            app.get('/mouvit/customers/show',authenticateJWT,function(req,res){
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                    .then(results => {
                        if (results.length > 0) {
                            if (results[0].role == "Admin" || results[0].role == "Super Admin") {
                                handleShowCustomers(req,res,customerCollection);
                            }
                            else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 401;
                                res.json({ "response_desc": "Permission Denied" });
                            }
                        }
                    }).catch(error=>{
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.json({ "response_desc": "Internal Server Error" });     
                });
                
            });


            //customer location
            app.put('/app/location/resource/customer/:customer_id',authenticateJWT,function(req,res){
                let messagePayload = {
                    location: req.body.location.lat+","+req.body.location.long
                }
                const customerLocationUpdateEvent = 'location_'+req.params.customer_id
                const realTimeNotificationChannel = ably.channels.get(operatorApigateway)
                realTimeNotificationChannel.publish(customerLocationUpdateEvent, messagePayload)
                handleUpdateCustomer(req,res,customerCollection);
            });
            //order related paths
            app.post('/app/order/resource/order/create',authenticateJWT,function(req,res){
                handleCreateOrder(req,res,orderCollection,inventoryCollection);
            });
            app.get('/app/order/resource/order/show',authenticateJWT,function(req,res){
                handleShowOrder(req,res,orderCollection);
            });
            app.get('/app/order/resource/order/:order_id',authenticateJWT,function(req,res){
                handleReadOrder(req.params.order_id,res,orderCollection);
            });
            app.put('/app/order/resource/order/:order_id',authenticateJWT,function(req,res){
                handleUpdateOrder(req,res,orderCollection,customerCollection,botCollection);
            });

            //verifcation id
            app.put('/app/idverification/resource/customer/:customer_id',multiUpload.array('images'),authenticateJWT,function(req,res){
                handleCustomerIdVerification(req,res,customerCollection)
            });
            app.get('/app/idverification/resource/customer/show',authenticateJWT,function(req,res){
                handleShowVerificationId(req.query.customer_id,res,customerCollection);
            });

            //customer messages
            app.post('/app/support/resource/message/create',authenticateJWT,function(req,res){
                handleCreateMessage(req,res,messageCollection);
            });
            app.get('/mouvit/customer/message/show',authenticateJWT,function(req,res){
                userCollection.find({ "username": currentUser.username }, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    if (results.length > 0) {
                        if (results[0].role == "Admin") {
                            handleShowMessage(req,res,messageCollection);
                        }
                        else {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 401;
                            res.json({ "response_desc": "Permission denied" });
                        }
                    }
                }).catch(error=>{
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.json({ "response_desc": "Internal Server Error" });     
                });
                
                
            });
            //product show
            app.get('/app/home/resource/products/show',authenticateJWT,function(req,res){
                    handleSearchProducts(req,res,productsCollection,inventoryCollection,botCollection);
            });

            //vehicle verification
            app.post('/app/order/action/verifyvehiclecode',authenticateJWT,function(req,res){
                handleVerifyVehicleCode(req,res,orderCollection,inventoryCollection,serviceproviderCollection);
            });

            //get product name and image path for home page slider
            app.get('/app/home/action/getproductbrief',authenticateJWT,function(req,res){
                handleGetProductBrief(res,productsCollection);
            });

            //payment/refund related Apis
            app.post('/app/order/action/createpaymentintent', authenticateJWT, function(req,res){
                handleCreatePaymentIntent(req,res,customerCollection,orderCollection,botCollection);
            });
            app.post('/app/order/action/confirmpaymentintent', authenticateJWT, function(req,res){
                handleConfirmPaymentIntent(req,res,orderCollection,customerCollection,botCollection);
            });
            app.post('/app/order/action/createrefund',authenticateJWT,function(req,res){
                handleCreateRefund(req,res,orderCollection);
            });
        }
    })

}

app.listen(4000, function () {
    initialize();
    console.log("listening on 4000");
})

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, 'secretkey', (err, user) => {

            if (err) {
                if (err.name == "TokenExpiredError") {
                    // return res.sendStatus(403);
                    res.statusCode = 403;
                    return res.json({ "response_desc": "Token Expired" })
                }

                else {
                    res.statusCode = 403;
                    return res.json({ "response_desc": "Forbidden" })
                }
            }


            req.user = user;
            currentUser = user.user;
            next();
        });
    } else {
        res.statusCode = 401;
        res.json({ "response_desc": "Unauthorized" })
    }
};


function handleLogin(user, res, userCollection, rolesCollection) {
    var userObj = user;
    var query = { "username": userObj.username };
    userCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                if (results[0]["password"] == md5(userObj["password"])) {
                    const queryToReadRoles = {"role_name": results[0].role}
                    rolesCollection.find(queryToReadRoles,{projection:{_id:0,role_id:0,role_name:0}}).toArray().then(result=>{
                        jwt.sign({ user: userObj }, 'secretkey', { expiresIn: '24h' }, (err, token) => {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.json({ token: token, firstname: results[0]["first_name"], username: results[0].username, role: results[0]["role"],menus_to_display:result[0].menus_to_display });
                        })
                    });
                }
                else if (results[0]["password"] != md5(userObj["password"])) {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 401;
                    res.json({ "response_desc": "Invalid Password" });
                }
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 401;
                res.json({ "response_desc": "Invalid credentials" });
            }
        });

}

async function handleSearchForRoles(req,res,rolesCollection){
    var s = req.query.searchParam;
    let result = await rolesCollection.aggregate([
        {
            "$search": {
                "index": "default",
                "autocomplete": {
                    "query": s,
                    "path": "role_name"
                }

            }
        },
        {
            $project: {
                "_id": 0,
                "role_name": 1
            }
        }
    ]).toArray();
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    let tArray = [];
    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "roles": result } }));
}

async function handleCreateForBot(body, res, botCollection,appsCollection) {
    body['bot_id'] =  Math.floor(Math.random() * 1000) + 1; 
    body['bot_status'] = 'idle'
    var queryForBot = { 'bot_id': body['bot_id'] }
    var queryForApp = {}
    var botConfigData = body
    let botId = body['bot_id']
    let dispenserConfigData = {}
    
    await botCollection.find(queryForBot, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "bot_id " + body['bot_id'] + "Already exists" });
            }
            else {
                queryForApp = {'app_id':body['associated_application']}
                appsCollection.find(queryForApp,{}).toArray().then(result=>{
                    if(result.length>0){
                        dispenserConfigData = result[0]
                    }

                    publishCommandForBotConfiguration(botId,botConfigData).then(result=>{
                        publishCommandForDispenserConfiguration(botId,dispenserConfigData).then(result=>{
                            createTableForBot(body, botCollection);
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.json({ "response_desc": "Bot created successfully" ,"bot_id":botId});
                        }).catch(error=>{
                            console.log(error)
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 500;
                            res.send({ "response_desc": "Internal Server Error" });
                        });
                        
                    }).catch(error=>{
                        console.log(error)
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.send({ "response_desc": "Internal Server Error" });
                    });

                }).catch(error=>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 500;
                    res.send({ "response_desc": "Internal Server Error" });
                });
            }
        }).catch(error=>{
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 500;
            res.send({ "response_desc": "Internal Server Error" });
        });
}

function publishCommandForBotConfiguration(botId,botConfigData){
    
    // publishTopic = botId+"/botConfiguration"
    // var messagePayload = {
    //     "Label":"Server-PCB",
    //     "Name":"Packet1",
    //     "Config":{
    //         "One Wheel/Two Wheel":"0",
    //         "Remote/Auto": "0"
    //     },
    //     "Posting Freq":{
    //         "Pkt1":"0",
    //         "Pkt1A":"0",
    //         "Pkt2":"0",
    //         "Pkt2A":"0"
    //     },
    //     "Hub Motor":{
    //         "CurLmt":"0",
    //         "Timeout":"0",
    //         "RPM":"0"
    //     },
    //     "WheelCircumference":"0",
    //     "Steering Motor":{
    //         "RPM":"0",
    //         "Timeout":"0",
    //         "FrntEncCalib":"0",
    //         "RearEncCalib":"0",
    //         "Deadband":"0"
    //     },
    //     "Lift Motor":{
    //         "DBA4LMRPM":"0",
    //         "DBA4LMtimeout":"0",
    //         "DBA4LMDeadband":"0",
    //         "DBA7LMRPM":"0",
    //         "DBA7LMtimeout":"0",
    //         "DBA7LMDeadband":"0"
    //     },
    //     "Thermal System":{
    //         "SPLow":"0",
    //         "SHigh":"0",
    //         "HysLow":"0",
    //         "HysHigh":"0"
    //     },
    //     "Battery":{
    //         "BatCL1":"0",
    //         "BatCL2":"0",
    //         "SOCLimit":"0"
    //     },
    //     "NX Data":{
    //         "USBFPS":"0",
    //         "CSIFPS":0,
    //         "USBRes":"",
    //         "CSIRes":"",
    //         "OPRes":"",
    //         "SpkVol":"0",
    //         "MicEn":"0"
    //     },
    //     "Spare":{
    //         "Sp1":0,
    //         "Sp2":0
    //     }

    // }

    // if(botConfigData){
    //     if(botConfigData.one_wheel_two_wheel_mode == "two_wheel"){
    //         messagePayload.Config["One Wheel/Two Wheel"] = 1
    //     }
    //     if(botConfigData.remote_auto_mode == "auto"){
    //         messagePayload.Config["Remote/Auto"] = 1
    //     }

    //     messagePayload["Posting Freq"].Pkt1 = botConfigData.posting_frequency_packet_1.toString()
    //     messagePayload["Posting Freq"].Pkt1A = botConfigData.posting_frequency_packet_1A.toString()
    //     messagePayload["Posting Freq"].Pkt2 = botConfigData.posting_frequency_packet_2.toString()
    //     messagePayload["Posting Freq"].Pkt2A = botConfigData.posting_frequency_packet_3.toString()
        
    //     messagePayload["Hub Motor"].CurLmt = botConfigData.hub_motor_current_limit.toString()
    //     messagePayload["Hub Motor"].Timeout = botConfigData.hub_motor_timeout.toString()
    //     messagePayload["Hub Motor"].RPM = botConfigData.hub_motor_rpm_limit.toString()
        
    //     messagePayload["WheelCircumference"] = botConfigData.wheel_circumference.toString()
        
    //     messagePayload["Steering Motor"].RPM = botConfigData.steering_motor_rpm.toString()
    //     messagePayload["Steering Motor"].Timeout = botConfigData.steering_motor_timeout.toString()
    //     messagePayload["Steering Motor"].FrntEncCalib = botConfigData.steering_motor_encoder_front_caliberation.toString()
    //     messagePayload["Steering Motor"].RearEncCalib = botConfigData.steering_motor_encoder_rear_caliberation.toString()
    //     messagePayload["Steering Motor"].Deadband = botConfigData.steering_motor_deadband.toString()
        
    //     messagePayload["Lift Motor"].DBA4LMRPM = botConfigData.dba4_lift_motor_rpm.toString()
    //     messagePayload["Lift Motor"].DBA4LMtimeout = botConfigData.dba4_lift_motor_timeout.toString()
    //     messagePayload["Lift Motor"].DBA4LMDeadband = botConfigData.dba4_Lift_motor_deadband.toString()
    //     messagePayload["Lift Motor"].DBA7LMRPM = botConfigData.dba7_lift_motor_rpm.toString()
    //     messagePayload["Lift Motor"].DBA7LMtimeout = botConfigData.dba7_lift_motor_timeout.toString()
    //     messagePayload["Lift Motor"].DBA7LMDeadband = botConfigData.dba7_Lift_motor_deadband.toString()
        
    //     messagePayload["Thermal System"].SPLow = botConfigData.thermal_system_setpoint_low_side.toString()
    //     messagePayload["Thermal System"].SHigh = botConfigData.thermal_system_setpoint_high_side.toString()
    //     messagePayload["Thermal System"].HysLow = botConfigData.hysteris_low_side.toString()
    //     messagePayload["Thermal System"].HysHigh = botConfigData.hysteris_high_side.toString()
        
    //     messagePayload["Battery"].BatCL1 = botConfigData.battery_cutoff_limit_1.toString()
    //     messagePayload["Battery"].BatCL2 = botConfigData.battery_cutoff_limit_2.toString()
    //     messagePayload["Battery"].SOCLimit = botConfigData.power_up_soc.toString()
        
    //     messagePayload["NX Data"].USBFPS = botConfigData.usb_fps.toString()
    //     messagePayload["NX Data"].CSIFPS = botConfigData.csi_fps.toString()
    //     messagePayload["NX Data"].USBRes = botConfigData.usb_resolution
    //     messagePayload["NX Data"].CSIRes = botConfigData.csi_resolution
    //     messagePayload["NX Data"].OPRes = botConfigData.output_resolution
    //     messagePayload["NX Data"].SpkVol = botConfigData.bot_speaker_volume.toString()
    //     if(botConfigData.bot_microphone_enable_disable == "true"){
    //         messagePayload["NX Data"].MicEn = 1
    //     }
        
    //     messagePayload["Spare"].Sp1 = botConfigData.spare_config_1
    //     messagePayload["Spare"].Sp2 = botConfigData.spare_config_2

    // }

    return new Promise((resolve,reject)=>{
        resolve('data')
        // iotServerThing.publish(publishTopic, JSON.stringify(messagePayload),
        // { qos: 1, retain: false, dup: false }, function (error, data) {
        //     if(error){
        //         reject(error)
        //     } else {
        //         resolve(data)
        //     }
        // })
    })
    

}

function publishCommandForDispenserConfiguration(botId,dispenserConfigData){
    // publishTopic = botId+"/dispenserConfiguration"
    // var messagePayload = {
    //         "Label":"Server-Dispensor",
    //         "Name":"Packet1",
    //         "Parameter":{
    //             "Pkt1":"0",
    //             "Pkt1A":"0",
    //             "Pkt2":"0",
    //             "Pkt3":"0",
    //             "MtrTimeout":"0",
    //             "Temp_Sp":"0",
    //             "Temp_Hys":"0",
    //             "BatCutOffLmt1":"0",
    //             "BatCutOffLmt2":"0",
    //             "SpConfig1":"0",
    //             "SpConfig2":"0",
    //             "SpConfig3":"0",
    //             "SpConfig4":"0",
    //             "SpConfig5":"0"
    //         }
    //     }

    // messagePayload.Parameter['Pkt1'] = dispenserConfigData.posting_frequency_packet_1.toString()
    // messagePayload.Parameter['Pkt1A'] = dispenserConfigData.posting_frequency_packet_1A.toString()
    // messagePayload.Parameter['Pkt2'] = dispenserConfigData.posting_frequency_packet_2.toString()
    // messagePayload.Parameter['Pkt3'] = dispenserConfigData.posting_frequency_packet_3.toString()
    // messagePayload.Parameter['MtrTimeout'] = dispenserConfigData.dispensing_lift_motor_timeout.toString()
    // messagePayload.Parameter['Temp_Sp'] = dispenserConfigData.thermal_system_setpoint.toString()
    // messagePayload.Parameter['Temp_Hys'] = dispenserConfigData.thermal_system_hysterisis.toString()
    // messagePayload.Parameter['BatCutOffLmt1'] = dispenserConfigData.battery_cutoff_limit_1.toString()
    // messagePayload.Parameter['BatCutOffLmt2'] = dispenserConfigData.battery_cutoff_limit_2.toString()
    // messagePayload.Parameter['SpConfig1'] = dispenserConfigData.spare_config_1.toString()
    // messagePayload.Parameter['SpConfig2'] = dispenserConfigData.spare_config_2.toString()
    // messagePayload.Parameter['SpConfig3'] = dispenserConfigData.spare_config_3.toString()
    // messagePayload.Parameter['SpConfig4'] = dispenserConfigData.spare_config_4.toString()
    // messagePayload.Parameter['SpConfig5'] = dispenserConfigData.spare_config_5.toString()
    

    return new Promise((resolve,reject)=>{
        resolve('data')
        // iotServerThing.publish(publishTopic, JSON.stringify(messagePayload),
        // { qos: 1, retain: false, dup: false }, function (error, data) {
        //     if(error){
        //         reject(error)
        //     } else {
        //         resolve(data)
        //     }
        // })
    })


}

function handleUpdateForBot(body, res, botCollection,appsCollection) {
    var queryForBot = { 'bot_id': body['bot_id'] }
    var queryForApp = {}
    var botConfigData = body
    let botId = body['bot_id']
    let dispenserConfigData = {}

    botCollection.find(queryForBot, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                queryForApp = {'app_id':body['associated_application']}
                appsCollection.find(queryForApp,{}).toArray().then(result=>{
                    if(result.length>0){
                        dispenserConfigData = result[0]
                    }

                    publishCommandForBotConfiguration(botId,botConfigData).then(result=>{
                        publishCommandForDispenserConfiguration(botId,dispenserConfigData).then(result=>{
                            updateTableForBot(body, botCollection);
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.json({ "response_desc": "Bot Updated successfully" });
                        }).catch(error=>{
                            console.log(error)
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 500;
                            res.send({ "response_desc": "Internal Server Error" });
                        });
                        
                    }).catch(error=>{
                        console.log(error)
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.send({ "response_desc": "Internal Server Error" });
                    });

                }).catch(error=>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 500;
                    res.send({ "response_desc": "Internal Server Error" });
                });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "bot_id " + body['bot_id'] + "does not exist" });
            }
        })
}

async function handleShowForBot(req, res, botCollection) {
    let display_params=["bot_id","associated_application","area_of_service","associated_service_provider","bot_status"];
    let query = {}
    if(req.query.page){
        if (req.query.search) {
            let s = req.query.search;
            await botCollection.find({
                $or: [
                    { bot_id: new RegExp(s, "i") },
                    { associated_application: new RegExp(s, "i") },
                    { associated_service_provider: new RegExp(s, "i") },
                    { deployed_country: new RegExp(s, "i") },
                    { deployed_state: new RegExp(s, "i") },
                    { deployed_region: new RegExp(s, "i") }
                ]
            },{ projection: { _id: 0 } }).toArray()
                .then(textSearchRes => {
                    // console.log(JSON.stringify(textSearchRes));
                    const page = parseInt(req.query.page);
                    const limit = 10;
                    const startIndex = (page - 1) * limit;
                    const endIndex = page * limit;
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = textSearchRes.length;
                    textSearchRes = textSearchRes.slice(startIndex, endIndex);
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "bots": textSearchRes },"display_params":display_params}));
                });
        }
        else {
            const page = parseInt(req.query.page);
            const limit = 10;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            botCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = results.length;
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "bots": results },"display_params":display_params }));
                })
                .catch(error => console.error(error))
        }
    }
    else{
       if(req.query.service_provider) {
           query = {'associated_service_provider': req.query.service_provider}
       }
       botCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            // set the header and status
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send(JSON.stringify({"response_desc": "Operation successful", "data": { "bots": results },"display_params":display_params }));
        })
        .catch(error => console.error(error))
    }
}

function handleReadForBot(botId, res, botCollection) {
    var query = { "bot_id": botId };
    botCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "bot": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + botId + " not found" });
            }
        })
}

function handleDeleteforBot(botId, res, botCollection) {
    var query = { "bot_id": botId };
    botCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + botId + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + botId + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + botId });
        }
    });
}

async function handleSearchForBots(req, res, botCollection){
    var s = req.query.searchParam;
    let result = await botCollection.find({$or:[{bot_id: new RegExp(s, "i")}]},
        {
            $project: {
                "_id": 0,
                "bot_id": 1
            }
        }
    ).toArray();
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    let tArray = [];

    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "bots": result } }))
}

async function createTableForBot(body, botCollection) {
    await botCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForBot(body, botCollection) {
    var query = { "bot_id": body["bot_id"] };
    data = { $set: body }
    await botCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

//Apps
function handleCreateForApps(body, res, appsCollection) {
    var query = { 'app_id': body['app_id'] };
    appsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "App ID " + body['app_id'] + "Already exists" });
            }
            else {
                createTableForApps(body, appsCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "App created successfully" });
            }
        })
}

function handleUpdateForApps(body, res, appsCollection) {
    var queryForApp = { 'app_id': body['app_id'] };
    appsCollection.find(queryForApp, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                updateTableForApps(body, appsCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "App Updated successfully" });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "App ID " + body['app_id'] + "does not exist" });
            }
        }).catch(error=>{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 500;
            res.send({ "response_desc": "Internal Server Error" });
        });
}

async function handleShowForApps(req, res, appsCollection) {
    let display_params=["type_of_application","app_id","posting_frequency_packet_1","posting_frequency_packet_1A","posting_frequency_packet_2"];
    if (req.query.search) {
        let s = req.query.search;
        await appsCollection.find({
            $or: [
                { type_of_application: new RegExp(s, "i") },
                { app_id: new RegExp(s, "i") },
                { associated_inventory: new RegExp(s, "i") },
                { type_of_inventory: new RegExp(s, "i") },
                { one_wheel_two_wheel_mode: new RegExp(s, "i") },
                { remote_auto_mode: new RegExp(s, "i") },
                { bot_microphone_enable_disable: new RegExp(s, "i") },

            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "apps": textSearchRes },"display_params":display_params }));
            })
    }
    else {
        await appsCollection.find({ $or: [{ type_of_application: new RegExp('foo') }, { app_name: new RegExp('foo') }] }).toArray()
            .then(textSearchRes => {
            })
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        appsCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "apps": results },"display_params":display_params }));
            })
            .catch(error => console.error(error))
    }
}

function handleReadForApps(appsId, res, appsCollection) {
    var query = { "app_id": appsId };
    appsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "app": results } }));
            } else {
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + appsId + " not found" });
            }
        })
}

function handleDeleteforApps(appsId, res, appsCollection) {
    var query = { "app_id": appsId };
    appsCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + appsId + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + appsId + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + appsId });
        }
    });
}

async function createTableForApps(body, appsCollection) {
    await appsCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForApps(body, appsCollection) {
    var query = { "app_id": body["app_id"] };
    data = { $set: body }
    await appsCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

//Products
async function handleCreateForProducts(body, res, productsCollection) {
    let product_id;
    await productsCollection.find({}).sort({_id:-1}).limit(1).toArray()
        .then(results => {
            if (results.length > 0) {
                product_id=parseInt(results[0].product_id)+1;
            }
            else {   
                product_id="1";     
            }
        })
    body.product_id=product_id.toString();
    createTableForProducts(body,productsCollection);
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    res.json({ "response_desc": "Product created successfully" });
    // let fileContent= Buffer.from(body.image_path.replace(/^data:image\/\w+;base64,/, ""),'base64')
    // body.image_path = fileContent
    // var data = {
    //     Bucket: productBucket,
    //     Key:  product_id.toString()+body.product_name.replace(/\s/g, ""), 
    //     Body: fileContent,
    //     ContentEncoding: 'base6s4',
    //     ContentType: 'image/jpeg'
    // };
    // await s3bucket.upload(data, function(err, data){
    //     if (err) { 
    //     res.setHeader('content-type', 'Application/json');
    //     res.statusCode = 400;
    //     res.json({ "response_desc": "Product Image Uploading Failed" });
    //     } else {
    //     body.product_id=product_id.toString();
    //     createTableForProducts(body,productsCollection);
    //     res.setHeader('content-type', 'Application/json');
    //     res.statusCode = 200;
    //     res.json({ "response_desc": "Product created successfully" });
    //     }
    // });  
}

function handleUpdateForProducts(body, res, productsCollection) {
    var query = { 'product_id': body['product_id'] };
    productsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                updateTableForProducts(body, productsCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "Product Updated successfully" });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "product_id " + body['product_id'] + "does not exist" });
            }
        })
}

async function handleShowForProducts(req, res, productsCollection) {
    let display_params=["product_id","product_name","flavour_variation","price_in_usd",'tax_in_percentage'];
    if(req.query.page){
        if (req.query.search) {
            let s = req.query.search;
            await productsCollection.find({
                $or: [
                    { type_of_product: new RegExp(s, "i") },
                    { product_name: new RegExp(s, "i") },
                    { product_id: new RegExp(s, "i") }
                ]
            },{ projection: { _id: 0 } }).toArray()
                .then(textSearchRes => {
                    const page = parseInt(req.query.page);
                    const limit = 10;
                    const startIndex = (page - 1) * limit;
                    const endIndex = page * limit;
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = textSearchRes.length;
                    textSearchRes = textSearchRes.slice(startIndex, endIndex);
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "products": textSearchRes },"display_params":display_params }));
                })
        }
        else {
            const page = parseInt(req.query.page);
            const limit = 10;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            productsCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = results.length;
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "products": results },"display_params":display_params }));
                })
                .catch(error => console.error(error))
            }
    }
    else{
        productsCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({"response_desc": "Operation successful", "data": { "products": results }}));
        }).catch(error => console.error(error))
    }
}

async function handleReadForProducts(productsId, res, productsCollection) {
    var query = { "product_id": productsId };
    await productsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "product": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + productsId + " not found" });
            }
    })
}

async function createTableForProducts(body,productsCollection) {
    await productsCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForProducts(body, productsCollection) {
    var query = { "product_id": body["product_id"] };
    data = { $set: body }
    await productsCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

function handleDeleteforProducts(productsId, res, productsCollection) {
    var query = { "product_id": productsId };
    productsCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + productsId + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + productsId + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + productsId });
        }
    });
}

//Service Provider
async function handleCreateForServiceProvider(body, res, serviceproviderCollection,mapsCollection) {
    var random = Math.floor(Math.random() * 1000) + 1;
    body['unique_id'] = random.toString();
    var query = { 'unique_id': body['unique_id'] };
    let getGeoCode = {}

    await serviceproviderCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "unique_id " + body['unique_id'] + "Already exists" });
            }
            else {
                createTableForServiceProvider(body, serviceproviderCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "Service Provider created successfully" });
            }
        }).catch(error =>{
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode =500;
            res.json({ "response_desc": "Internal Server Error"});
        });
    
    // getGeoCode.position = await getForwardGeoCode(body.address1, body.country, body.code)
    // getGeoCode.coordinate_id = body['unique_id'];
    // getGeoCode.label = 'SP'+body['unique_id'];
    // getGeoCode.title = body.service_provider_name;
    // getGeoCode.type = 'service_provider';

    // await createOrUpdateMapCoordinates(getGeoCode,mapsCollection)

    // res.setHeader('content-type', 'Application/json');
    // res.statusCode = 200;
    // res.json({ "response_desc": "Service Provider created successfully" });
}

async function getForwardGeoCode(address,country,zipcode){
    try {
    const res = await geocoder.geocode({
        address: address,
        country: country,
        zipcode: zipcode
      })
      return {lat: res[0].latitude, long: res[0].longitude}
    }
    catch(error) {
        console.log(error)
    }
}

async function createOrUpdateMapCoordinates(geoCodeData, mapsCollection){
    const query = {'coordinate_id': geoCodeData.coordinate_id, 'type': geoCodeData.type}
    
    await mapsCollection.find(query,{}).toArray().then(searchResult=>{
        if(searchResult.length > 0){
            mapsCollection.updateOne(query,{$set:geoCodeData})
            .then((result, error) => {
                if (error) {
                    console.log(error);
                }
            }).catch(error => console.error(error))
        } else {
            mapsCollection.insertOne(geoCodeData)
            .then((result, error) => {
                if (error) {
                    console.log(error);
                }
            }).catch(error => console.error(error))
        }
    }).catch(error => console.error(error))
}

async function deleteMapCoordinates (coordinateId,mapsCollection,callback){
    const deleteQuery = {'coordinate_id': coordinateId}
    await mapsCollection.deleteOne(deleteQuery).then(result=>{
        callback(null)
    }).catch(error=>{
        callback(error)
    });
}

async function handleUpdateForServiceProvider(body, res, serviceproviderCollection,mapsCollection) {
    var query = { 'unique_id': body['unique_id'] };
    let getGeoCode = {}
    let serviceProviderSearchResult = []
    await serviceproviderCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                serviceProviderSearchResult = results
                updateTableForServiceProvider(body, serviceproviderCollection);
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "unique_id " + body['unique_id'] + "does not exist" });
            }
        })
    
    if(body.address1 !== serviceProviderSearchResult[0].address1 
        || body.country !== serviceProviderSearchResult[0].country 
        || body.code !== serviceProviderSearchResult[0].code 
        ) 
        {
            getGeoCode.position = await getForwardGeoCode(body.address1, body.country, body.code)
            getGeoCode.coordinate_id = body['unique_id'];
            getGeoCode.label = 'SP'+body['unique_id'];
            getGeoCode.title = body.service_provider_name;
            getGeoCode.type = 'service_provider';

            await createOrUpdateMapCoordinates(getGeoCode,mapsCollection)
    }
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    res.json({ "response_desc": "Service Provider Updated successfully" });
}

async function handleShowForServiceProvider(req, res, serviceproviderCollection) {
    let display_params=["service_provider_name","first_name","last_name","email","city"];
    if (req.query.search) {
        let s = req.query.search;
        await serviceproviderCollection.find({
            $or: [
                { first_name: new RegExp(s, "i") },
                { service_provider_name: new RegExp(s, "i") },
                { last_name: new RegExp(s, "i") },
                { address: new RegExp(s, "i") },
                { email: new RegExp(s, "i") },
                { country: new RegExp(s, "i") },
                { state: new RegExp(s, "i") },
                { region: new RegExp(s, "i") },
                { unique_id: new RegExp(s, "i") }

            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "service_providers": textSearchRes },"display_params":display_params }));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        serviceproviderCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "service_providers": results },"display_params":display_params}));
            })
            .catch(error => console.error(error))
    }
}

function handleReadForServiceProvider(uniqueId, res, serviceproviderCollection) {
    var query = { "unique_id": uniqueId };
    serviceproviderCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "service_provider": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + uniqueId + " not found" });
            }
        })
}

function handleDeleteforServiceProvider(uniqueId, res, serviceproviderCollection, mapsCollection) {
    var query = { "unique_id": uniqueId };

    deleteMapCoordinates(uniqueId,mapsCollection,function(error){
        if(error){
            console.log(error)
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 500;
            res.send({ "response_desc": "Internal Server Error" });
        }
        else{
            serviceproviderCollection.deleteOne(query, function (err, obj) {
                if (err) {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 404;
                    res.send({ "response_desc": "delete :  " + uniqueId + " not found" });
                }
                // n in results indicates the number of records deleted
                if (obj.result.n == 0) {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 404;
                    res.send({ "response_desc": "delete :  " + uniqueId + " not found" });
                } else {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send({ "response_desc": "record deleted :  " + uniqueId });
                }
            });
        }
    });
}

async function createTableForServiceProvider(body, serviceproviderCollection) {
    await serviceproviderCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForServiceProvider(body, serviceproviderCollection) {
    var query = { "unique_id": body["unique_id"] };
    data = { $set: body }
    await serviceproviderCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

//Remote Operator
function handleCreateForRemoteOperator(body, res, remoteoperatorCollection) {
    var random = Math.floor(Math.random() * 10000) + 1;
    body['unique_id'] = random.toString();
    var query = { 'unique_id': body['unique_id'] };
    remoteoperatorCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "unique_id " + body['unique_id'] + "Already exists" });
            }
            else {
                createTableForRemoteOperator(body, remoteoperatorCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "Remote Operator created successfully" });
            }
        })
}

function handleUpdateForRemoteOperator(body, res, remoteoperatorCollection) {
    var query = { 'unique_id': body['unique_id'] };
    remoteoperatorCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                updateTableForRemoteOperator(body, remoteoperatorCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "Remote Operator Updated successfully" });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "unique_id " + body['unique_id'] + "does not exist" });
            }
        })
}

async function handleShowForRemoteOperator(req, res, remoteoperatorCollection) {
    let display_params=["first_name","last_name","email","city","state"];
    if (req.query.search) {
        let s = req.query.search;
        await remoteoperatorCollection.find({
            $or: [
                { first_name: new RegExp(s, "i") },
                { middle_name: new RegExp(s, "i") },
                { last_name: new RegExp(s, "i") },
                { address: new RegExp(s, "i") },
                { email: new RegExp(s, "i") },
                { mac_id: new RegExp(s, "i") },
                { unique_id: new RegExp(s, "i") }

            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "remote_operators": textSearchRes },"display_params":display_params }));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        remoteoperatorCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "remote_operators": results },"display_params":display_params}));
            })
            .catch(error => console.error(error))
    }
}

function handleReadForRemoteOperator(uniqueId, res, remoteoperatorCollection) {
    var query = { "unique_id": uniqueId };
    remoteoperatorCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "remote_operator": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + uniqueId + " not found" });
            }
        })
}

function handleDeleteforRemoteOperator(uniqueId, res, remoteoperatorCollection) {
    var query = { "unique_id": uniqueId };
    remoteoperatorCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + uniqueId + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + uniqueId + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + uniqueId });
        }
    });
}

async function createTableForRemoteOperator(body, remoteoperatorCollection) {
    await remoteoperatorCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForRemoteOperator(body, remoteoperatorCollection) {
    var query = { "unique_id": body["unique_id"] };
    data = { $set: body }
    await remoteoperatorCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

//Maintenance Info
async function handleCreateForMaintenanceInfo(body, res, maintenanceinfoCollection) {
    // var random = Math.floor(Math.random() * 100) + 1;
    // body['bot_id'] = random.toString();
    // var query = { 'bot_id': body['bot_id'] };
    let maintenance_id=Math.floor(Math.random() * 100) + 1;
    await maintenanceinfoCollection.find({}).sort({_id:-1}).limit(1).toArray()
        .then(results => {
            if (results.length > 0) {
                maintenance_id=parseInt(results[0].maintenance_id)+1;
                body.maintenance_id=maintenance_id.toString();
                createTableForMaintenanceInfo(body, maintenanceinfoCollection);
            }
            else{
                body.maintenance_id=maintenance_id.toString();
                createTableForMaintenanceInfo(body, maintenanceinfoCollection);
            }
        }).catch(error =>{
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode =500;
            res.json({ "response_desc": "Internal Server Error"});
        });
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    res.json({ "response_desc": "Maintenance Info created successfully" });
}

function handleUpdateForMaintenanceInfo(body, res, maintenanceinfoCollection) {
    var query = { 'maintenance_id': body['maintenance_id'] };
    maintenanceinfoCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                updateTableForMaintenanceInfo(body, maintenanceinfoCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "Maintenance Info Updated successfully" });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "Maintenance-info" + body['maintenance_id'] + "does not exist" });
            }
        })
}

async function handleShowForMaintenanceInfo(req, res, maintenanceinfoCollection) {
    let display_params=["maintenance_id","performed_by","remarks","action","bot_id"];
    if (req.query.search) {
        let s = req.query.search;
        await maintenanceinfoCollection.find({
            $or: [
                { performed_by: new RegExp(s, "i") },
                { remarks: new RegExp(s, "i") },
                { action: new RegExp(s, "i") },
                { bot_id: new RegExp(s, "i") },
                { maintenance_id:new RegExp(s,"i")}
            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "maintenance_infos": textSearchRes },"display_params":display_params}));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        maintenanceinfoCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "maintenance_infos": results },"display_params":display_params }));
            })
            .catch(error => console.error(error))
    }
}

function handleReadForMaintenanceInfo(maintenanceId, res, maintenanceinfoCollection) {
    var query = { "maintenance_id": maintenanceId };
    maintenanceinfoCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "maintenance_info": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + maintenanceId + " not found" });
            }
        })
}

function handleDeleteforMaintenanceInfo(maintenanceId, res, maintenanceinfoCollection) {
    var query = { "maintenance_id": maintenanceId };
    maintenanceinfoCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + maintenanceId + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + maintenanceId + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + maintenanceId });
        }
    });
}

async function createTableForMaintenanceInfo(body, maintenanceinfoCollection) {
    await maintenanceinfoCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForMaintenanceInfo(body, maintenanceinfoCollection) {
    var query = { "maintenance_id": body["maintenance_id"] };
    data = { $set: body }
    await maintenanceinfoCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

//Charging Stations
async function handleCreateForChargingStations(body, res, chargingstationsCollection,mapsCollection) {
    var random = Math.floor(Math.random() * 100) + 1;
    body['station_id'] = random.toString();
    var query = { 'station_id': body['station_id'] };
    let getGeoCode = {}
    let coordinates = body.location.split(',')

    await chargingstationsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "station_id " + body['station_id'] + "Already exists" });
            }
            else {
                createTableForChargingStations(body, chargingstationsCollection);
            }
        })
    
    getGeoCode.position = {lat: coordinates[0].trim(), long: coordinates[1].trim()}
    getGeoCode.coordinate_id = body['station_id']
    getGeoCode.label = 'CS'+body['station_id']
    getGeoCode.title = body.station_label;
    getGeoCode.type = 'charging_station';

    await createOrUpdateMapCoordinates(getGeoCode,mapsCollection)

    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    res.json({ "response_desc": "Charging Station Info created successfully" });
}

async function handleUpdateForChargingStations(body, res, chargingstationsCollection, mapsCollection) {
    var query = { 'station_id': body['station_id'] };
    let getGeoCode = {}
    let coordinates = []
    let remoteOperatorSearchResult = []
    await chargingstationsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                remoteOperatorSearchResult = results
                updateTableForChargingStations(body, chargingstationsCollection);
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "station_id " + body['station_id'] + "does not exist" });
            }
        }).catch(error=>console.log(error))
        if(body.location !== remoteOperatorSearchResult[0].location) {
            coordinates = body.location.split(',')
            getGeoCode.position = {lat: coordinates[0].trim(), long: coordinates[1].trim()}
            getGeoCode.coordinate_id = body['station_id'];
            getGeoCode.label = 'CS'+body['station_id'];
            getGeoCode.title = body.station_label;
            getGeoCode.type = 'charging_station';

            await createOrUpdateMapCoordinates(getGeoCode, mapsCollection)
         }
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Charging Station Updated successfully" });
}

async function handleShowForChargingStations(req, res, chargingstationsCollection) {
    let display_params=["station_label","location","service_provider_name","current_status","station_id"];
    if (req.query.search) {
        let s = req.query.search;
        await chargingstationsCollection.find({
            $or: [
                { station_label: new RegExp(s, "i") },
                { service_provider_id: new RegExp(s, "i") },
                { current_status: new RegExp(s, "i") },
                { station_id: new RegExp(s, "i") }
            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "charging_stations": textSearchRes },"display_params":display_params }));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        chargingstationsCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "charging_stations": results },"display_params":display_params}));
            })
            .catch(error => console.error(error))
    }
}

function handleReadForChargingStations(stationId, res, chargingstationsCollection) {
    var query = { "station_id": stationId };
    chargingstationsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "charging_station": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + stationId + " not found" });
            }
        })
}

function handleDeleteforChargingStations(stationId, res, chargingstationsCollection,mapsCollection) {
    var query = { "station_id": stationId };
    deleteMapCoordinates(stationId,mapsCollection,function(error){
        if(error){
            console.log(error)
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 500;
            res.send({ "response_desc": "Internal Server Error" });
        }
        else{
            chargingstationsCollection.deleteOne(query, function (err, obj) {
                if (err) {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 404;
                    res.send({ "response_desc": "delete :  " + stationId + " not found" });
                }
                // n in results indicates the number of records deleted
                if (obj.result.n == 0) {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 404;
                    res.send({ "response_desc": "delete :  " + stationId + " not found" });
                } else {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send({ "response_desc": "record deleted :  " + stationId });
                }
            });
        }
    })
}

async function createTableForChargingStations(body, chargingstationsCollection) {
    await chargingstationsCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForChargingStations(body, chargingstationsCollection) {
    var query = { "station_id": body["station_id"] };
    data = { $set: body }
    await chargingstationsCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

function getLastNMonths(n){
    var months =['','01','02','03','04','05','06','07','08','09','10','11','12'];
      var monthsArray = new Array();
    
      var today = new Date();
      var year = today.getFullYear();
      var month = today.getMonth()+1;
    
      var i = 0;
      while(i<n){
        monthsArray.push( year+'-'+months[parseInt((month > 9 ? "" : "0") + month)]);
        if (month == 1) {
          month = 12;
          year--;
        } else {
          month--;
        }
        i++;
      }
      return monthsArray;
}

async function handleDashboardGet(queryParam, res,orderCollection,customerCollection,botCollection) {
    let currentDate = new Date().toISOString().substring(0,10)
    let monthsArray = getLastNMonths(10)
    let daysArray = getDatesOfWeek(1,2)
    let monthlyDatesArray = []
    let weeklyDatesArray = getDatesOfWeek(1)
    let lastMonthDate = new Date(new Date().getTime() - 60 * 60 * 24 * (7*4) * 1000)
    let start = new Date(lastMonthDate.setDate(lastMonthDate.getDate())).toISOString().substring(0, 10)
    start = new Date(start)
    while (start <= new Date(currentDate)) {
        date = new Date(start).toISOString()
        monthlyDatesArray.push(date.substring(0,10).toString());
        start.setUTCDate(start.getUTCDate() + 1);
        
    }

    if (queryParam.param == "orders_fulfilled") {   
        let currentDayOrdersFulFilled = 0
        let weeklyOrdersFulFilled = 0
        let monthlyOrdersFulFilled = 0

        //current date order fullfilled
        await orderCollection.find({datetime: new RegExp(currentDate, "i"),order_status:'order_delivered'}).toArray().then(result=>{
            if(result.length>0){
                currentDayOrdersFulFilled = result.length
            }
        })
        //weekly and monthly order fullfilled
        await orderCollection.find({order_status:'order_delivered'}).toArray().then(result=>{
            if(result.length>0){
                for(let i=0;i<result.length;i++){
                    for(let j=0;j<weeklyDatesArray.length;j++){
                        if(result[i].datetime.substring(0,10) == weeklyDatesArray[j]){
                            weeklyOrdersFulFilled += 1
                        }
                    }
                    for(let k=0;k<monthlyDatesArray.length;k++){
                        if(result[i].datetime.substring(0,10) == monthlyDatesArray[k]){
                            monthlyOrdersFulFilled += 1
                        }
                    }
                }
            }
        })

        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Operation successful",
            "dashboard_param": "orders_fulfilled",
            "data": {
                "daily": currentDayOrdersFulFilled,
                "weekly": weeklyOrdersFulFilled,
                "monthly": monthlyOrdersFulFilled
            }
        });
    }
    else if (queryParam.param == "customers_signed_up") {
        let currentDayCustomerSignUp = 0
        let WeeklyCustomerSignUp = 0
        let MonthlyDayCustomerSignUp = 0

        //weekly and monthly customersignup
        await customerCollection.find({}).toArray().then(result=>{
            if(result.length>0){
                for(let i=0;i<result.length;i++){
                    let creationDate = result[i].creation_date
                    if(creationDate == currentDate){
                        currentDayCustomerSignUp += 1
                    }
                    for(let j=0;j<weeklyDatesArray.length;j++){
                        if(creationDate == weeklyDatesArray[j]){
                            WeeklyCustomerSignUp += 1
                        }
                    }
                    for(let k=0;k<monthlyDatesArray.length;k++){
                        if(creationDate == monthlyDatesArray[k]){
                            MonthlyDayCustomerSignUp += 1
                        }
                    }
                }
            }
        })

        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "customers_signed_up",
            "data": {
                "daily": currentDayCustomerSignUp,
                "weekly": WeeklyCustomerSignUp,
                "monthly": MonthlyDayCustomerSignUp
            }
        });
    }
    else if (queryParam.param == "remote_drivers_online") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "remote_drivers_online",
            "data": {
                "daily": 34,
                "weekly": 45,
                "monthly": 27
            }
        });
    }
    else if (queryParam.param == "service_providers_that_have_performed_an_order") {
        let serviceProvidersPerformedOrderToday = []
        let serviceProvidersPerformedOrderWeekly = []
        let serviceProvidersPerformedOrderMonthly = []
        //find bots
        await botCollection.find({}).toArray().then(async result=>{
            if(result.length>0){
                for(let i=0;i<result.length;i++){
                    let botId = result[i].bot_id
                    //find orders under bot
                    await orderCollection.find({'bot_id':botId}).toArray().then(orders=>{
                        if(orders.length>0){
                            for(let j=0;j<orders.length;j++){
                                //check any service provide performed order today
                                if(orders[j].datetime.substring(0,10) == currentDate){
                                    if(!serviceProvidersPerformedOrderToday.includes(result[i].associated_service_provider)){
                                        serviceProvidersPerformedOrderToday.push(result[i].associated_service_provider)
                                    }
                                }
                                for(let k=0;k<weeklyDatesArray.length;k++){
                                    //service provide performed order today in this week
                                    if(orders[j].datetime.substring(0,10) == weeklyDatesArray[k]){
                                        if(!serviceProvidersPerformedOrderWeekly.includes(result[i].associated_service_provider)){
                                            serviceProvidersPerformedOrderWeekly.push(result[i].associated_service_provider)
                                        }
                                    }
                                }
                                for(let l=0;l<monthlyDatesArray.length;l++){
                                    //service provide performed order today in this month
                                    if(orders[j].datetime.substring(0,10) == monthlyDatesArray[l]){
                                        if(!serviceProvidersPerformedOrderMonthly.includes(result[i].associated_service_provider)){
                                            serviceProvidersPerformedOrderMonthly.push(result[i].associated_service_provider)
                                        }
                                    }
                                }
                            }
                        }
                    })
                }
            }
        })

        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "service_providers_that_have_performed_an_order",
            "data": {
                "daily": serviceProvidersPerformedOrderToday.length,
                "weekly": serviceProvidersPerformedOrderWeekly.length,
                "monthly": serviceProvidersPerformedOrderMonthly.length
            }
        });
    }

    else if (queryParam.param == "orders_performed") {
        let lastNdaysOrdersPerformed = [0,0,0,0,0,0,0,0,0,0]
        let lastNdaysCustomerSignedUp = [0,0,0,0,0,0,0,0,0,0]
        let lastNMonthOrdersPerformed = [0,0,0,0,0,0,0,0,0,0]
        let lastNMonthCustomerSignedUp = [0,0,0,0,0,0,0,0,0,0]

        await orderCollection.find({order_status:'order_delivered'}).toArray().then(orders=>{
            if(orders.length>0){
                for(let i=0;i<orders.length;i++){
                    for(let k=0;k<daysArray.length;k++){
                        //service provide performed order today in this week
                        if(orders[i].datetime.substring(0,10) == daysArray[k]){
                            lastNdaysOrdersPerformed[k] += 1 
                        }
                    }

                    for(let l=0;l<monthsArray.length;l++){
                        if(orders[i].datetime.substring(0,7) == monthsArray[l]){
                            lastNMonthOrdersPerformed[l] += 1
                        }
                    }

                }
            }
        })

        await customerCollection.find({}).toArray().then(customers=>{
            if(customers.length>0){
                for(let i=0;i<customers.length;i++){
                    let creationDate = customers[i].creation_date
                    for(let k=0;k<daysArray.length;k++){
                        if(creationDate == daysArray[k]){
                            lastNdaysCustomerSignedUp[k] += 1
                        }
                    }
                    for(let l=0;l<monthsArray.length;l++){
                        if(creationDate.substring(0,7) == monthsArray[l]){
                            lastNMonthCustomerSignedUp[l] += 1 
                        }
                    }
                }
            }
        })

        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "orders_performed",
            "data": {
                "daily": {
                    "dates": daysArray,
                    "orders": lastNdaysOrdersPerformed,
                    "customers": lastNdaysCustomerSignedUp
                },
                "monthly": {
                    "dates": monthsArray,
                    "orders": lastNMonthOrdersPerformed,
                    "customers": lastNMonthCustomerSignedUp
                }
            }
        });
    }
    else if (queryParam.param == "customers_served") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "customers_served",
            "data": {
                "daily": {
                    "dates": ["17-jan-21", "18-jan-21", "19-jan-21", "20-jan-21", "21-jan-21", "22-jan-21", "23-jan-21", "24-jan-21", "25-jan-21", "26-jan-21"],
                    "orders": [5, 10, 15, 6, 5, 1, 12, 2, 6, 4],
                    "customers": [2, 8, 4, 6, 2, 4, 5, 2, 7, 9]
                },
                "monthly": {
                    "dates": ["aug 20", "sep 20", "oct 20", "nov20", "dec 20", "jan 21", "feb 21", "mar 21", "apr 21", "may 21"],
                    "orders": [5, 8, 10, 13, 7, 5, 6, 6, 1, 4],
                    "customers": [5, 10, 15, 6, 5, 1, 12, 2, 6, 4]
                }
            }
        });
    }
    else if (queryParam.param == "average_duration_of_an_order") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "average_duration_of_an_order",
            "data": {
                "daily": {
                    "dates": ["17/01/2021", "18/01/2021", "19/01/2021", "20/01/2021", "21/01/2021", "22/01/2021", "23/01/2021", "24/01/2021", "25/01/2021", "26/01/2021"],
                    "avg_duration": [12.1, 10.2, 11.5, 6.6, 5.1, 1.8, 12.2, 2.8, 6.5, 4.9]
                },
                "monthly": {
                    "dates": ["aug 20", "sep 20", "oct 20", "nov20", "dec 20", "jan 21", "feb 21", "mar 21", "apr 21", "may 21"],
                    "avg_duration": [12.1, 10.2, 11.5, 6.6, 5.1, 1.8, 12.2, 2.8, 6.5, 4.9]
                }
            }
        });
    }
    else if (queryParam.param == "active_bots_and_operators") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Operation successful", "dashboard_param": "active_bots_and_operators", "data": { "mobilty_devices": "50", "remote_operators": "30" } });
    }
    else if (queryParam.param == "hours_driven") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Operation successful", "dashboard_param": "hours_driven", "data": { "x-driven_time": [1, 2, 3, 4, 5, 6, 7, 8, 9], "y-no_of_bots": [3, 7, 8, 6, 1, 6, 7, 3, 2] } });
    }
    else if (queryParam.param == "usage_of_each_appilcation") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Operation successful", "dashboard_param": "usage_of_each_appilcation", "data": { "number_of_orders": [25, 10, 20, 1], "application_name": ['foo', 'foobar', 'foocar', 'barfoo'] } });
    }
    else if (queryParam.param == "number_of_bots_deployed_for_each_application") {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({ "response_desc": "Operation successful", "dashboard_param": "number_of_bots_deployed_for_each_application", "data": { "number_of_bots_deployed": [25, 10, 15, 0], "application_name": ['foo', 'foobar', 'foocar', 'barfoo'] } });
    }
    else if(queryParam.param=="current_orders"){
        let currentOrders = []
        await orderCollection.find({},{projection:{_id:0,payment:0,products:0,order_feedback:0,total_tax:0,total_delivery:0,bot_location:0,bot_id:0,service_state:0}}).sort({_id:-1}).limit(10).toArray().then(result=>{
            if(result.length>0){
                currentOrders = result
            }
        })
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.json({
            "response_desc": "Operation successful",
            "dashboard_param": "current_orders",
            "data": currentOrders
        });
    }
}

function getDatesOfWeek(week,daysToAdd=0){
    var beforeGivenWeek = new Date(new Date().getTime() - 60 * 60 * 24 * ((7*week)+daysToAdd) * 1000)
    var beforeGivenWeek2 = new Date(beforeGivenWeek);
    let startDateFromGivenWeek = beforeGivenWeek.getDate()
    let startDate = new Date(beforeGivenWeek.setDate(startDateFromGivenWeek))
    let start = startDate.toISOString().substring(0, 10)
    let endDate = new Date(beforeGivenWeek2.setDate(startDateFromGivenWeek + (7+daysToAdd)));
    end = endDate.toISOString().substring(0, 10)

    let dateArray = []
    let date;
    start = new Date(start)
    while (start <= new Date(end)) {
        date = new Date(start).toISOString()
        dateArray.push(date.substring(0,10).toString());
        start.setUTCDate(start.getUTCDate() + 1);
        
    }
    return dateArray
}

function getOrderRecordsUnderServiceProvider(serviceProvider,search,week,orderCollection,botCollection){
    let dates = getDatesOfWeek(week)
    let ordersAssociatedToServiceProvider = []
    let searchQuery = {}
    return new Promise((resolve,reject)=>{botCollection.find({'associated_service_provider':serviceProvider},{ projection: { _id: 0 } }).toArray()
        .then(async botsAssociatedToServicesProviders => {
            for(let i=0;i<botsAssociatedToServicesProviders.length;i++){
                if(search!==null){
                    searchQuery = {
                        $and:[{'bot_id':botsAssociatedToServicesProviders[i].bot_id}],
                        $or: [
                            {datetime: new RegExp(search, "i") },
                            {order_id: new RegExp(search, "i") },
                            {customer_id: new RegExp(search, "i")},
                            {total_amount: new RegExp(search, "i")},
                            {order_status: new RegExp(search, "i")}
                        ]
                    }
                } else {
                    searchQuery = {'bot_id':botsAssociatedToServicesProviders[i].bot_id}
                }

                await orderCollection.find(searchQuery,{projection:{_id:0}}).toArray().then(result=>{
                    for(let i=0; i<result.length;i++){
                        let orderDateTime = result[i].datetime.substring(0,10)
                        for(let j=0;j<dates.length;j++){
                            if(orderDateTime === dates[j]){
                                ordersAssociatedToServiceProvider.push(result[i]) 
                            }
                        }
                    }

                }).catch(error=>{
                    reject(error)
                });
            }
            resolve(ordersAssociatedToServiceProvider)
        }).catch(error=>{
            reject(error)
        });
    })
}

async function handleReportingForServiceProviderOperation(req, res, orderCollection,botCollection) {
    const displayParams = ['datetime','order_id','customer_id','total_amount','order_status']
    let week = parseInt(req.query.week)
    let search = null

        if (req.query.service_provider) {
            let serviceProvider = req.query.service_provider
            if(req.query.search){
                search = req.query.search;
            }
            // botCollection.createIndex({ "$**": "text" });
            // await botCollection.find({ $text: { $search: req.query.search } }).toArray()
            //     .then(textSearchRes => {
            //         console.log(JSON.stringify(textSearchRes));
            //     })
            getOrderRecordsUnderServiceProvider(serviceProvider,search,week,orderCollection,botCollection).then(ordersAssociatedToServiceProvider=>{
                if(req.query.page){
                    let page = parseInt(req.query.page);
                    let limit = 10;
                    let startIndex = (page - 1) * limit;
                    let endIndex = page * limit;
                    let resultsCount = ordersAssociatedToServiceProvider.length;
                    ordersAssociatedToServiceProvider = ordersAssociatedToServiceProvider.slice(startIndex, endIndex);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "mobilty_device_report": ordersAssociatedToServiceProvider },'display_params':displayParams }));
                } else {
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({ "data": { "mobilty_device_report": ordersAssociatedToServiceProvider }}));
                }
                
            }).catch(error=>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 500;
                res.send({ "response_desc": "Internal Server Error" });
            });
                    
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 400;
            res.send(JSON.stringify({"response_desc": "Invalid Request Format"}));
        }
    }




async function handleReportingForMobiltyDevice(req, res, mobilityDeviceReportCollection) {
    let limit;
    if (!req.query.page) {
        limit = 'all'
    }
    else {
        limit = 10;
    }
    if (req.query.search) {
        // botCollection.createIndex({ "$**": "text" });
        // await botCollection.find({ $text: { $search: req.query.search } }).toArray()
        //     .then(textSearchRes => {
        //         console.log(JSON.stringify(textSearchRes));
        //     })
        let s = req.query.search;
        await mobilityDeviceReportCollection.find({
            $or: [
                { bot_id: new RegExp(s, "i") },
                { driver_name: new RegExp(s, "i") }
            ]
        },{ projection: { _id: 0 } }).toArray()
            .then(textSearchRes => {
                // console.log(JSON.stringify(textSearchRes));
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "mobility_device_report": textSearchRes } }));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        mobilityDeviceReportCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                if (limit == 'all') {
                    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "mobility_device_report": results } }));
                }
                else {
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "mobility_device_report": results } }));
                }

            })
            .catch(error => console.error(error))
    }

}

async function handleSearchForApps(req, res, appsCollection) {
    var s = req.query.searchParam;
    let result = await appsCollection.aggregate([
        {
            "$search": {
                "index": "default",
                "autocomplete": {
                    "query": s,
                    "path": "app_id"
                }

            }
        },
        {
            $project: {
                "_id": 0,
                "app_id": 1
            }
        }
    ]).toArray();
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    let tArray = [];
    // for (let e of result) {
    //     tArray.push({ 'app_name': e['app_name'] });
    // }
    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "apps": result } }));
}

async function handleSearchForServiceProvider(req, res, serviceproviderCollection) {
    var s = req.query.searchParam;
    let result = await serviceproviderCollection.aggregate([
        {
            "$search": {
                "index": "default",
                "autocomplete": {
                    "query": s,
                    "path": "service_provider_name"
                }

            }
        },
        {
            $project: {
                "_id": 0,
                "service_provider_name": 1
            }
        }
    ]).toArray();
    res.setHeader('content-type', 'Application/json');
    res.statusCode = 200;
    let tArray = [];
    // for (let e of result) {
    //     tArray.push({ 'app_name': e['app_name'] });
    // }
    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "service_provider": result } }));

}


function handleCreateForUser(req, res, userCollection) {
    var query = { 'username': req.body["username"] };
    userCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 409;
                res.json({ "response_desc": "User " + req.body['username'] + "Already exists" });
            }
            else {
                createTableForUser(req.body, userCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "User created successfully" });
            }
        })
}

function handleReadForUser(req, res, userCollection) {
    var query = { "username": req.query.id };
    userCollection.find(query, {projection:{_id:0,password:0}}).toArray()
        .then(results => {
            if (results.length > 0) {
                // set header, status code and send the entry
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({ "response_desc": "Operation successful", "data": { "user": results } }));
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({ "response_desc": "Read : " + req.query.username + " not found" });
            }
        })
}

function handleUpdateForUser(req, res, userCollection) {
    var query = { 'username': req.body['username'] };
    userCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                updateTableForUser(req.body, userCollection);
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.json({ "response_desc": "User Updated successfully" });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "user " + req.body['username'] + "does not exist" });
            }
        })
}

async function handleChangePassword(req,username,res,userCollection){
    let query={"username":username};
    userCollection.find(query).toArray().then(reslt=>{
        if(reslt.length>0){
            if(reslt[0].password==md5(req.body.old_password)){
                let data = { $set:{ password:md5(req.body.new_password)}};
                userCollection.updateOne(query,data).then((result, error)=>{
                    if(error){
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 400;
                        res.send({ "response_desc": "Password Updation Failed" });
                    }
                    else{
                        jwt.sign({ user: {"username":username,"password":req.body.new_password} }, 'secretkey', { expiresIn: '24h' },(err, token) => {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 201;
                            res.send({"response_desc":"Password Updated Successfully",token: token, firstname: reslt[0]["first_name"], role: reslt[0]["role"] });
                        });
                        }
                    }).catch(error=>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.send({ "response_desc": "Internal Server Error" });
                    });
                }
            else{
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 400;
                res.send({ "response_desc": "You Have Entered Invalid Old Password" });
                }
            }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "User " + req.body.username + " Not Found" });
        }
    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.send({ "response_desc": "Internal Server Error" });
    });;
}

function handleDeleteForUser(req, res, userCollection) {
    var query = { "username": req.query.id };
    userCollection.deleteOne(query, function (err, obj) {
        if (err) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + req.query.username + " not found" });
        }
        // n in results indicates the number of records deleted
        if (obj.result.n == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "delete :  " + req.query.username + " not found" });
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send({ "response_desc": "record deleted :  " + req.query.username });
        }
    });
}

async function handleShowForUser(req, res, userCollection) {
    let display_params=["username","first_name","mobile_number","email","role"];
    if (req.query.search) {
        let s = req.query.search;
        await userCollection.find({
            $or: [
                { username: new RegExp(s, "i") },
                { first_name: new RegExp(s, "i") },
                { last_name: new RegExp(s, "i") },
            ]
        },{projection:{_id:0,password:0}}).toArray()
            .then(textSearchRes => {
                // console.log(JSON.stringify(textSearchRes));
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "users": textSearchRes },"display_params":display_params }));
            })
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        userCollection.find({}, {projection:{_id:0,password:0}}).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "users": results },"display_params":display_params }));
            })
            .catch(error => console.error(error))
    }
}


async function createTableForUser(body, userCollection) {
    body["password"] = md5(body["password"]);
    await userCollection.insertOne(body)
        .then((result, error) => {
            if (error) {
                console.log(error);
            }
        }).catch(error => console.error("error"))
}

async function updateTableForUser(body, userCollection) {
    var query = { "username": body["username"] };
    data = { $set: body }
    await userCollection.updateOne(query, data)
        .then((result, error) => {
        }).catch(error => console.error("error"))
}

function returnStaticMapCoordinates(res, mapsCollection) {
    const query = {$or:[
                {type:'service_provider'},
                {type:'charging_station'},
            ]}
    mapsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            // set the header and status
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send(JSON.stringify({ "response_desc": "Operation successful", "data": results }));
        })
        .catch(error => console.error(error))
}

function returnDynamicMapCoordinates(res,mapsCollection){
    const query = {type:'bot'}
    mapsCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            // set the header and status
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.send(JSON.stringify({ "response_desc": "Operation successful", "data": results }));
        })
        .catch(error => console.error(error))
}
//inventory
async function handleCreateInventory(req,res,inventoryCollection){
    let query={"bot_id":req.body.bot_id};
    let inventory_id;
    let inventoryData = []
    let Inventorytrays = {'Tray 1':0,'Tray 2':0,'Tray 3':0}

    //check whether inventory is already present under the bot
    await inventoryCollection.find(query,{}).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 409;
            res.send({ "response_desc": "Inventory Already Exists Under Mobility Device " + req.body.bot_id });
        }
        else{
            //check the latest record to get the inventory_id of last record
            inventoryCollection.find({}).sort({_id:-1}).limit(1).toArray().then(result=>{
                if(result.length>0){
                   inventory_id=parseInt(result[0].inventory_id,10);
                }
                else{
                   inventory_id=Math.floor(Math.random() * 100) + 1; 
                }
                let i=1;
                req.body.trays.forEach(function (arrayItem) {
                    Inventorytrays[arrayItem.tray] = arrayItem.quantity
                    inventoryData.push({"inventory_id":(inventory_id+i).toString(),"product_id":arrayItem.product_id,"product_name":arrayItem.product_name,"quantity":arrayItem.quantity,"service_provider":req.body.service_provider,"bot_id":req.body.bot_id,"application_name":req.body.application_name,"datetime":new Date(),"tray":arrayItem.tray})
                    i=i+1;
                });

                publishCommandForInventoryLoad(req.body.bot_id,Inventorytrays).then(result=>{
                    for(i=0; i<inventoryData.length; i++){
                        inventoryCollection.insertOne(inventoryData[i]).then((result,error)=>{
                            if(error){
                                console.log(error)
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 400;
                                res.send({ "response_desc": "Inventory Creation Failed" });
                            }}).catch(error=>{
                            console.log(error)
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 500;
                            res.json({ "response_msg": "Internal Server Error"});
                        });
                    }
                }).catch(error=>{
                    console.log(error)
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 500;
                    res.json({ "response_msg": "Internal Server Error"});
                });

                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send({ "response_desc": "Inventory Created Successfully" });
                
            }).catch(error=>{
                console.log(error)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 500;
                res.json({ "response_msg": "Internal Server Error"});
            });
        }
    }).catch(error=>{
        console.log(error)
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_msg": "Internal Server Error"});
    });
}

function handleUpdateInventory(req,res,inventoryCollection){
    let queryInventory={"inventory_id":req.body.inventory_id};
    let Inventorytrays = {'Tray 1':0,'Tray 2':0,'Tray 3':0}
    let botID = "" 
    let tray = ""  
    let data

    inventoryCollection.find(queryInventory,{}).toArray().then(result=>{
        if(result.length>0){
            botID = result[0].bot_id
            queryInventory = {'bot_id': botID}
            tray = result[0].tray
            inventoryCollection.find(queryInventory,{}).toArray().then(result=>{
                for(let i=0;i<result.length;i++){
                    Inventorytrays[result[i].tray] = result[i].quantity
                }

                Inventorytrays[tray] = req.body.quantity

                publishCommandForInventoryLoad(botID,Inventorytrays).then(result=>{
                    queryInventory={"inventory_id":req.body.inventory_id};
                    data={$set:req.body};
                    inventoryCollection.updateOne(queryInventory,data).then((result,error)=>{
                        if(error){
                            console.log(error)
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 400;
                            res.json({ "response_msg": "Inventory Updation Failed"});
                        }
                        else{
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 201;
                            res.json({ "response_msg": "Inventory Updated Successfully"});
                        }
                    }).catch(error=>{
                        console.log(error)
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 500;
                        res.json({ "response_msg": "Internal Server Error"});
                    });   

                }).catch(error=>{
                console.log(error)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 500;
                res.json({ "response_msg": "Internal Server Error"});
            });

            }).catch(error=>{
                console.log(error)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 500;
                res.json({ "response_msg": "Internal Server Error"});
            });
            
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.json({ "response_msg": "Inventory Not Found"});
        }
    }).catch(error=>{
        console.log(error)
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_msg": "Internal Server Error"});
    });
}


function publishCommandForInventoryLoad(botID,Inventorytrays){
    // publishTopic = botID+"/inventoryLoad"
    // let messagePayload = {"Label":"Server-Dispensor",
    //                       "Name":"Packet3",
    //                       "Inventory":{
    //                             "TopTray":Inventorytrays["Tray 1"].toString(),
    //                             "MidTray":Inventorytrays["Tray 2"].toString(),
    //                             "LowTray":Inventorytrays["Tray 3"].toString()
    //                         }
    //                     }

    return new Promise((resolve,reject)=>{
        resolve('data')
        // iotServerThing.publish(publishTopic, JSON.stringify(messagePayload),
        // { qos: 1, retain: false, dup: false }, function (error, data) {
        //     if(error){
        //         reject(error)
        //     } else {
        //         resolve(data)
        //     }
        // })
    })
}
function handleReadInventory(inventoryId,res,inventoryCollection){
    let query={"inventory_id":inventoryId};
    inventoryCollection.find(query,{projection:{_id:0}}).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.json({ "response_msg": "Operation Successful","data":result[0]});
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.json({ "response_msg": "Inventory Not Found"});
        }
    }).catch(error=>{
        console.log(error)
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_msg": "Internal Server Error"});
    });
}

function handleDeleteInventory(inventoryId,res,inventoryCollection){
    let query = { "inventory_id":inventoryId};
    inventoryCollection.deleteOne(query).then(result=>{
        if (result.deletedCount == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "Inventory Not Found" });
        }
        else{
            res.setHeader('content-type','Application/json');
            res.statusCode=200;
            res.send({"response_desc": "Inventory "+inventoryId+" Deleted Successfully"});
        }

    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

async function handleShowInventory(req,res,inventoryCollection){
    let display_params=["product_name","quantity","service_provider","bot_id","tray"];
    let query = {}
    if (req.query.search) {
        let s = req.query.search;
        if(req.query.service_provider){
            query = {
                $and :[
                    {service_provider :req.query.service_provider}
                ],
                $or: [
                    { product_name: new RegExp(s, "i") },
                    { quantity: new RegExp(s, "i") },
                    { bot_id: new RegExp(s, "i") },
                    { tray: new RegExp(s, "i") },
                    { service_provider : new  RegExp(s, "i")},
                ]
            }
        }
        else{
            query = {
                $or: [
                    { product_name: new RegExp(s, "i") },
                    { quantity: new RegExp(s, "i") },
                    { bot_id: new RegExp(s, "i") },
                    { tray: new RegExp(s, "i") },
                    { service_provider : new  RegExp(s, "i")},
                ]
            }
        }
        await inventoryCollection.find(query,{projection:{_id:0}}).toArray()
            .then(textSearchRes => {
                // console.log(JSON.stringify(textSearchRes));
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "inventorys": textSearchRes },"display_params":display_params }));
            }).catch(error=>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        if(req.query.service_provider){
            query={'service_provider':req.query.service_provider}
        }
        inventoryCollection.find(query, {projection:{_id:0}}).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "inventorys": results },"display_params":display_params }));
            }).catch(error=>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
    }
}

function publishTwilioMessage(messageBody,sendToNumber,sendFromNumber){
    twilioClient.messages.create({
        body: messageBody,
        to: sendToNumber,
        from: sendFromNumber
    }).then((error,message)=>{
    }).catch(error=>{
        console.log(error)
    });
}

async function handleInventoryDepletion(productsOrdered,botId,inventoryCollection,serviceproviderCollection){
    let messageBody;
    let sendToNumber;
    let sendFromNumber;
    let serviceProvider;
    let queryToFindInventory = {}
    let trays = {
        "Tray 1":0,
        "Tray 2":0,
        "Tray 3":0
    }
    let lowInventory=false

    for(let i=0;i<productsOrdered.length;i++){
        queryToFindInventory = {'inventory_id':productsOrdered[i].inventory_id}
        await findInventory(queryToFindInventory,inventoryCollection).then(data=>{
            let dataTobeUpdate = {
                'quantity':data.current_quantity-productsOrdered[i].quantity
            }
            trays[data.tray] = productsOrdered[i].quantity
            inventoryCollection.updateOne(queryToFindInventory,{$set:dataTobeUpdate})
            if((data.current_quantity-productsOrdered[i].quantity) <= 3){
                lowInventory = true
                serviceProvider = data.service_provider
            }
        }).catch(error=>{
            console.log(error);
        })
    }
    publishCommandForOrderData(botId,trays)
    if(lowInventory){
        serviceproviderCollection.find({'service_provider_name':serviceProvider}).toArray().then(result=>{
            if(result.length>0){
                //publish low inventory message to service provider
                messageBody= `Low Inventory Alert\nDear Service Provider Your inventory is low for the Bot ${botId}`
                sendToNumber = result[0].phone_number
                sendFromNumber = '+13059128896' 
                publishTwilioMessage(messageBody,sendToNumber,sendFromNumber)
            }
        })
    }
    
}

function findInventory(queryToFindInventory,inventoryCollection){
    return new Promise((resolve,reject)=>{
        inventoryCollection.find(queryToFindInventory,{}).toArray().then(result=>{
            if(result.length>0){
                let tray = result[0].tray
                let currentQuantity = result[0].quantity
                resolve({'tray':tray,'current_quantity':currentQuantity,'bot_id':result[0].bot_id,'service_provider':result[0].service_provider})
            } else {
                reject('Inventory Not Found')
            }
        }).catch(error=>{
            console.log(error)
        })
    })
}

function publishCommandForOrderData(botID,Inventorytrays){
    publishTopic = botID+'/orderData'
    let messagePayload = {"Label":"Server-Dispensor",
    "Name":"Packet2",
    "Order":{
          "TopTray":Inventorytrays["Tray 1"].toString(),
          "MidTray":Inventorytrays["Tray 2"].toString(),
          "LowTray":Inventorytrays["Tray 3"].toString()
      }
  }

    return new Promise((resolve,reject)=>{
        iotServerThing.publish(publishTopic, JSON.stringify(messagePayload),
        { qos: 1, retain: false, dup: false }, function (error, data) {
            if(error){
                reject(error)
            } else {
                resolve(data)
            }
        })
    })
}






async function handleBotDoorOpen(botId,res){
    await publishCommandForBotDoorOpen(botId).then((data)=>{
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.send({ "response_desc": "Operation Successful"});
    }).catch(error=>{
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 400;
        res.send({ "response_desc": "Operation Failed" });
    });
    
}

function publishCommandForBotDoorOpen(botID){
    publishTopic = botID+'/openDoor'

    let messagePayload = {
        "Label":"Server-Dispensor",
        "Name":"Packet4",
        "Command":{
        "DoorOpen":"1"
        }
    }

    return new Promise((resolve,reject)=>{
        iotServerThing.publish(publishTopic, JSON.stringify(messagePayload),
         { qos: 1, retain: false, dup: false }, function (error, data) {
            // if qos is 0 then there will be no acknowledgement
            if (error) {
                reject(false)
            } else {
                resolve(true)
            }
        })
    })
}


//firmware
async function handleCreateFirmware(req,res,firmwareCollection){
    let firmwareId="";
    await firmwareCollection.find({},{projection:{_id:0}}).sort({_id:-1}).limit(1).toArray().then(result=>{
        if(result.length>0){
            firmwareId=parseInt(result[0].firmware_id,10)+1;
        }
        else{
            firmwareId="1";
        }
    });
    req.body.firmware_id=firmwareId.toString();
    req.body.datetime=new Date();
    let fileContent= Buffer.from(req.body.file_path.replace(/^data:image\/\w+;base64,/, ""),'base64')
    let data = {
        Bucket: firmwareBucket,
        Key:  req.body.file_name, 
        Body: fileContent,
        ContentEncoding: 'base6s4',
      };
    await s3bucket.upload(data, function(err, data){
        if (err) { 
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 400;
        res.json({ "response_desc": "Firmware File Uploading Failed" });
        } else {
        req.body.file_path=data.Location;
        firmwareCollection.insertOne(req.body).then((result,error)=>{
            if(error){
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 400;
                res.json({ "response_desc": "Firmware Creation Failed"});
            }
            else{
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 201;
                res.json({ "response_desc": "Firmware Created Successfully"});
            }
        }).catch(error=>{
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode =500;
            res.json({ "response_desc": "Internal Server Error"});
        });
        }
    });

}

function handleReadFirmware(firmwareId,res,firmwareCollection){
    let query={"firmware_id":firmwareId};

    firmwareCollection.find(query,{projection:{_id:0}}).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.json({ "response_msg": "Operation Successful","data":result[0]});
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.json({ "response_msg": "Firmwarer Not Found"});
        }
    }).catch(error=>{
        console.log(error)
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_msg": "Internal Server Error"});
    });
}

async function handleDeleteFirmware(firmwareId,res,firmwareCollection){
    let query={"firmware_id":firmwareId};
    await firmwareCollection.find(query,{}).toArray().then(result=>{
        if(result.length>0){
            //delete the file related to the firmware
            s3bucket.deleteObject({Bucket:firmwareBucket,Key:result[0].file_name},function(err,data){
                if(err)
                {
                    console.log(err)
                    res.setHeader('content-type','Application/json');
                    res.statusCode=400;
                    res.send({"response_desc": "Firmware Deletion Failed"});
                }
            else
                {
                    firmwareCollection.deleteOne(query).then(result=>{
                        if (result.deletedCount == 0) {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 404;
                            res.send({ "response_desc": "Firmware Not Found" });
                        }
                        else{
                            res.setHeader('content-type','Application/json');
                            res.statusCode=200;
                            res.send({"response_desc": "Firmware Deleted Successfully"});
                        }
                
                    }).catch(error=>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode =500;
                        res.json({ "response_desc": "Internal Server Error"});
                    });
                }
            }); 
        }
        else{
            res.setHeader('content-type','Application/json');
            res.statusCode=404;
            res.send({"response_desc": "Firmware Not Found"});
        }
    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

async function handleShowFirmware(req,res,firmwareCollection){
    let display_params=["firmware_type","version_number","datetime","file_name"];
    if (req.query.search) {
        let s = req.query.search;
        await firmwareCollection.find({
            $or: [
                { firmware_type: new RegExp(s, "i") },
                { version_number: new RegExp(s, "i") },
                {file_name:new RegExp(s, "i")}
            ]
        },{projection:{_id:0}}).toArray()
            .then(textSearchRes => {
                // console.log(JSON.stringify(textSearchRes));
                const page = parseInt(req.query.page);
                const limit = 10;
                const startIndex = (page - 1) * limit;
                const endIndex = page * limit;
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = textSearchRes.length;
                textSearchRes = textSearchRes.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "firmware": textSearchRes },"display_params":display_params }));
            }).catch(error=>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
    }
    else {
        const page = parseInt(req.query.page);
        const limit = 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        firmwareCollection.find({}, {projection:{_id:0}}).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                let resultsCount = results.length;
                results = results.slice(startIndex, endIndex);
                res.send(JSON.stringify({ "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "response_desc": "Operation successful", "data": { "firmware": results },"display_params":display_params }));
            }).catch(error=>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
    }
}

function handleGetLatestFirmware(firmwareType,res,firmwareCollection){
    let query={"firmware_type":firmwareType}
    firmwareCollection.find(query,{projection:{_id:0}}).sort({_id:-1}).limit(1).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.json({ "response_msg": "Operation Successful","data":result[0]});
        }
        else{
            res.setHeader('content-type','Application/json');
            res.statusCode=404;
            res.send({"response_desc": "Result Not Found"});
        }
    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

async function handleReadForCustomers(customerId,res,customerCollection){
    let queryForCustomer = {'customer_id':customerId};
    let customerData = []
    let images = []
    let imageData={"front":"","back":"","verification_status":""};
    let countOfImagesFetchedFromS3 = 0 

    await customerCollection.find(queryForCustomer,{projection:{_id:0,stripe_id:0}}).toArray().then(result=>{
        if(result.length>0){
            customerData = result
        }else{
            res.setHeader('content-type','Application/json');
            res.statusCode=400;
            res.send({"response_desc": "Customer Not Found"});
        }
    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });

    if(customerData.length>0){
        if(customerData[0].id_proof.front!=""){
            images.push("front")
        }
        if(customerData[0].id_proof.back!=""){
            images.push("back")
        }

        if(images.length>0){
            imageData.verification_status = customerData[0].id_proof.verification_status
            for(let i=0;i<images.length;i++){
                let file_name=customerId+images[i];
                let getParams = {
                    Bucket: idProofBucket, // your bucket name,
                    Key: file_name// path to the object you're looking for
                }
                await s3bucket.getObject(getParams, function(err, data) {
                    if (err){
                        console.log(err)
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 404;
                        res.send(JSON.stringify({ "response_desc": "Read Operation Failed"}));
                    }
                    else{
                        // imageData.push(data.Body.toString('base64'));
                        imageData[images[i]] = data.Body.toString('base64')
                        countOfImagesFetchedFromS3 += 1
                        if(countOfImagesFetchedFromS3==images.length){
                            customerData[0].id_proof=imageData;
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.send(JSON.stringify({ "response_desc": "Operation successful", "data": customerData}));
                        }
                    } 
                });
            }
        }
        else{
            res.setHeader('content-type','Application/json');
            res.statusCode=200;
            res.send(JSON.stringify({"response_desc": "Operation Successful","data":customerData}));
        }
    }

}



// App related functions
function handleOtpRequest(phone_number,res,otpCollection){
    let timeInMinutes=new Date().getTime() / 1000;
    let otp=otpGenerate();
    // Store phone number and otp in OtpCollections and Mail Otp as Response
    otpCollection.insertOne({"otp":md5(otp),"phone_number":phone_number,'time':timeInMinutes})
    .then((result, error) => {
        if (error) {
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 400;
            res.json({ "response_desc": "Otp Sending Failed, Please Try Again" });
        }
        else{
            twilioClient.messages.create({
                body: `Welcome to Mouvit. Please use ${otp} as the one time password for signing up for the app. It is valid for 10-mins. Happy Ordering.`,
                to: '+'+phone_number,  // Text this number
                from: '+13059128896' // From a valid Twilio number
            }).then((error,message)=>{
                 if(error){
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.json({ "response_msg": "Otp Sent Successfully  ",otp:otp});
                 }
                 else{
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 400;
                    res.json({ "response_msg": "Otp Sending Failed, Please Try Again"});
                 }
            }).catch(error=>{
                console.log(error)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 500;
                res.json({ "response_msg": "Internal Server Error"});
            });
        }
    }).catch(error=>{
        console.log(error)
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_msg": "Internal Server Error"});
    });
}

function otpGenerate(){
    let otp = "";
    do{
        let n=crypto.randomInt(0, 999999);
        otp = n.toString().padStart("0", 6);
    }while(otp.length!=6);
    return otp;
}


function handleOtpVerify(customer,res,otpCollection,customerCollection){
    //to get the minutes as floating point value(holds minutes and secods) 
    let currentTime=new Date().getTime() / 1000;
    let query={"phone_number":customer.phone_number ,"otp":md5(customer.otp)};
    otpCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(result => {
            if(result.length>0){
                let totalTime=currentTime-result[0].time;
                if(totalTime<=599){
                    let query1={"phone_number":customer.phone_number};
                    customerCollection.find(query1, { projection: {} }).toArray()
                    .then(results => {
                        if(results.length>0){
                            jwt.sign({ user: {"phone_number":customer.phone_number} }, 'secretkey', { expiresIn: '2160h' }, (err, token) => {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 200;
                                res.json({"response_desc":"Otp Verified Successfully", token: token,data:{customer_id:results[0].customer_id,phone_number:customer.phone_number,customer_name:results[0].customer_name,location:{lat:results[0].location.lat,long:results[0].location.long}}});
                            });
                        }
                        else{
                            jwt.sign({ user: {"phone_number":customer.phone_number} }, 'secretkey', { expiresIn: '2160h' }, (err, token) => {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.json({"response_desc":"Otp Verified Successfully",token: token,data:{customer_id:null,phone_number:customer.phone_number,customer_name:null,location:{lat:null,long:null}}});
                            });
                        }
                    }).catch(error =>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode =500;
                        res.json({ "response_desc": "Internal Server Error"});
                });
                }
                else{
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 410;
                    res.json({ "response_desc": "Your Otp Has Been Expired"  });
                }
            }
            else{
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 400;
                res.json({ "response_desc": "You Have Entered Invalid Otp"});  
            }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

//customer profile related functions
function handleCreateCustomer(customer,res,customerCollection){
    let random_number=otpGenerate();
    customer.customer_id="customer"+customer.customer_email.split("@")[0]+random_number.toString();
    customer.creation_date = new Date().toISOString().substring(0,10);
    customer.id_proof = {"front":"","back":"","verification_status":""}
    const searchForCustomer = {'phone_number':customer.phone_number}
    customerCollection.find(searchForCustomer).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode =409;
            res.json({ "response_desc": "Customer Already Exists Under Given Phone Number"});
        } else {
            customerCollection.insertOne(customer)
            .then((result, error) => {
                if (error) {
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =400;
                    res.json({ "response_desc": "Customer Creation Failed"});
                }
                else{
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 201;   
                    res.json({"response_desc":"Profile Created Successfully",data:{customer_id:customer.customer_id}});
                    
                }
            }).catch(error =>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
        }
    })
    
}

function handleUpdateCustomer(req,res,customerCollection){
    let query = { "customer_id":req.params.customer_id};
    customerCollection.find(query, { projection: { _id: 0 } }).toArray()
        .then(results => {
            if (results.length > 0) {
                data = { $set: req.body};
                customerCollection.updateOne(query, data)
                    .then((result, error) => {
                        if(error){
                            console.log(error);
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 400;
                            res.json({ "response_desc": "Profile Updation Failed"});
                        }
                        else{
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 200;
                            res.json({ "response_desc": "Profile Updated Successfully"});
                        }
                    }).catch(error =>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode =500;
                        res.json({ "response_desc": "Internal Server Error"});
                    });
            }
            else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.json({ "response_desc": "Customer Details Not Found" });
            }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    }); 
}


async function handleReadCustomer(customerId,res,customerCollection){
    let query = { "customer_id":customerId};
    customerCollection.find(query, { projection: { _id: 0,id_proof:0} }).toArray().then(result=>{
        if(result.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;
            res.json({ "response_desc":"Operation Successful","data":result});  
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.json({"response_desc":"Customer Details Not Found"});  
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

function handleDeleteCustomer(customerId,res,customerCollection){
    let query = { "customer_id":customerId};
    customerCollection.deleteOne(query).then(result=>{
        if (result.deletedCount == 0) {
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({ "response_desc": "Customer Details Not Found" });
        }
        else{
            res.setHeader('content-type','Application/json');
            res.statusCode=200;
            res.send({"response_desc": "Customer "+customerId+" Deleted Successfully"});
        }

    }).catch(error=>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
    
}

//for admin
function handleShowCustomers(req,res,customerCollection){
    let displayParams=["customer_id","customer_name","customer_email","phone_number","creation_date"];
    if(req.query.page){
        if (req.query.search) {
            let s = req.query.search;
            customerCollection.find({
                $or: [
                    { phone_number: new RegExp(s, "i") },
                    { customer_name: new RegExp(s, "i") },
                    { customer_email: new RegExp(s, "i") },
                ]
            }).toArray()
                .then(textSearchRes => {
                    const page = parseInt(req.query.page);
                    const limit = 10;
                    const startIndex = (page - 1) * limit;
                    const endIndex = page * limit;
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = textSearchRes.length;
                    textSearchRes = textSearchRes.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit },"data": { "customers": textSearchRes } ,"display_params":displayParams}));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
        }
        else {
            const page = parseInt(req.query.page);
            const limit = 10;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            customerCollection.find({}, { projection: {} }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = results.length;
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "data": { "customers": results } ,"display_params":displayParams}));
                })
                .catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
        }
    }
    else{
        customerCollection.find({}, { projection: {} }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "data": { "customers": results } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
    }
}

async function CheckForQunaityAvailability(productsPurchased,inventoryCollection){
    let quantityAvailable = true
    for(let i=0;i<productsPurchased.length;i++){
        let query = {'inventory_id':productsPurchased[i].inventory_id}
        await inventoryCollection.find(query).toArray().then(result=>{
            if(result.length>0){
                if(result[0].quantity<productsPurchased[i].quantity){
                    quantityAvailable = false
                }
            }
        })
        if(quantityAvailable == false){
            return quantityAvailable
        }
    }
    return quantityAvailable
}

//order related functions
async function handleCreateOrder(req,res,orderCollection,inventoryCollection){

    //order id should be created here
    // order id starting with last two degit of year and 004998
    let dat=req.body;
    dat.service_state = 0
    let year=new Date().getFullYear().toString().substr(2,2);
    let newRecordId=0;
    let quantityAvailable = await CheckForQunaityAvailability(dat.products,inventoryCollection)
    if(quantityAvailable){
        orderCollection.find({}).sort({_id:-1}).limit(1).toArray().then(result=>{
            if (result.length>0){
                let lastRecordIdStr=result[0].order_id;
                lastRecordIdStr=lastRecordIdStr.substring(2,lastRecordIdStr.length);
                newRecordId=parseInt(lastRecordIdStr)+1;
                if(newRecordId.toString().length==4){
                    newRecordId=year+"00"+newRecordId.toString();
                }
                if(newRecordId.toString().length==5){
                    newRecordId=year+"0"+newRecordId.toString();
                }
                orderCollection.find({'order_id':newRecordId},{}).toArray().then(response=>{
                    if(response.length>0){
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 400;
                        res.json({ "response_desc": "Order Creation Failed"});//duplicate order_id
                    }
                    else{
                       dat.order_id=newRecordId;
                       orderCollection.insertOne(dat).then((results,error)=>{
                        if(error){
                            console.log(error);
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 400;
                            res.json({ "response_desc": "Order Creation Failed"});
                        }
                        else{
                            subscribeToBotLocation(dat.bot_id,dat.order_id,orderCollection)
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 201;   
                            res.json({"response_desc":"Order Placed",data:{order_id:newRecordId}});
                        }
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
                    }
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
            }
            else{
                dat.order_id=year+"004499";
                orderCollection.insertOne(dat).then((results,error)=>{
                    if(error){
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 400;
                        res.json({ "response_desc": "Order Creation Failed"});
                    }
                    else{
                        subscribeToBotLocation(dat.bot_id,dat.order_id,orderCollection)
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 201;   
                        res.json({"response_desc":"Order Placed",data:{order_id:dat.order_id}});
                    }
            }).catch(error =>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
             });
        }
    
        }).catch(error =>{
            console.log(error);
            res.setHeader('content-type', 'Application/json');
            res.statusCode =500;
            res.json({ "response_desc": "Internal Server Error"});
        });
    } else {
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 500;
        res.json({ "response_desc": "Product Out oF Stock"});
    }
    
}

function subscribeToBotLocation(botId,orderId,orderCollection){
    let channel = ably.channels.get('api_gateway_'+botId)
    channel.subscribe('bot-location-update',function(message){
        if(Object.keys(message).length !== 0){
            let updateData = {
                lat: message.data['GPS']['Lat'],
                long:message.data['GPS']['Long']
            }
            orderCollection.updateOne({order_id:orderId},{$set:{'bot_location':updateData}})       
        }
    })
}

function handleReadOrder(orderId,res,orderCollection){
    let query={"order_id":orderId};
    orderCollection.find(query,{projection:{_id:0}}).toArray().then(results=>{
        if(results.length>0){
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 200;   
            res.json({"response_desc":"Operation Successful","data":results});
        } 
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;   
            res.json({"response_desc":"Order Details Not Found"}); 
        }  
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
});
}
function updateOrderRecord(query,dat,orderCollection){
    return new Promise((resolve,reject)=>{
        orderCollection.updateOne(query,dat).then((result, error) => {
            if(error){
                resolve('client_error')
            }
            else{
                resolve('success')
            }
            
        }).catch(error =>{
           reject(error)
        });
    })
    
}

async function handleUpdateOrder(req,res,orderCollection,customerCollection,botCollection){

    let query={"order_id":req.params.order_id};
    await orderCollection.find(query,{}).toArray().then(async results=>{
        if(results.length>0){
            let dat={$set:req.body};
            if('order_status' in req.body){
                if(req.body.order_status == 'order_cancelled'){
                    if(results[0].service_state === 5){
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 406;
                        res.json({ "response_desc": "Order Cancellation Not Allowed"});
                    } else {   
                        updateOrderRecord(query,dat,orderCollection).then(result=>{
                            if(result == 'client_error'){
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 400;
                                res.json({ "response_desc": "Order Updation Failed"});
                            } else {
                                PublishOrderCancelStatusToServiceManager(req.params.order_id,orderCollection,customerCollection,botCollection)
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode = 201;
                                res.json({ "response_desc": "Order Cancellation Successful"});
                            }
                        }).catch(error =>{
                            console.log(error);
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode =500;
                            res.json({ "response_desc": "Internal Server Error"});
                    });
                    }
                } else {
                    updateOrderRecord(query,dat,orderCollection).then(result=>{
                        if(result === 'client_error'){
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 400;
                            res.json({ "response_desc": "Order Updation Failed"});
                        } else {
                            res.setHeader('content-type', 'Application/json');
                            res.statusCode = 201;
                            res.json({ "response_desc": "Order Updation Successful"});
                        }
                    }).catch(error =>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode =500;
                        res.json({ "response_desc": "Internal Server Error"});
                });
                }
            } else {
                updateOrderRecord(query,dat,orderCollection).then(result=>{
                    if(result == 'client_error'){
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 400;
                        res.json({ "response_desc": "Order Updation Failed"});
                    } else {
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 201;
                        res.json({ "response_desc": "Order Updation Successful"});
                    }
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
            }
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.json({ "response_desc": "Order Details Not Found"}); 
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
});
}


async function PublishOrderCancelStatusToServiceManager(orderId,orderCollection,customerCollection,botCollection){
    let messagePayload = {
        'service_state':null,
        'message_id': null,
        'service_order_id':orderId,
        'customer_name':null,
        'service_provider':null,
        'fulfillment_location':null,
        'bot_id':null,
        'event_id' : null,
        'timestamp' : Math.floor((new Date()).getTime() / 1000),
    }
    orderCollection.find({'order_id':orderId},{}).toArray().then(async result=>{
        if(result.length>0){
            let customerId = result[0].customer_id
            messagePayload.bot_id = result[0].bot_id
            messagePayload.service_state = result[0].service_state
    
            await customerCollection.find({customer_id:customerId},{}).toArray().then(customer=>{
                if(customer.length>0){
                    messagePayload.customer_name = customer[0].customer_name
                    messagePayload.fulfillment_location = customer[0].location.lat+' '+customer[0].location.long
                }
            })

            await botCollection.find({'bot_id':result[0].bot_id}).toArray().then(bot=>{
                if(bot.length>0){
                    messagePayload.service_provider = bot[0].associated_service_provider
                }
            })
        }

        //publish message to server Manager
        publishOrderStatus(serverManageApiGatewayChannel,OrderCancelEvent,messagePayload)
    })
}


function handleShowOrder(req,res,orderCollection){
    //with pagination
    if(req.query.page){
        if (req.query.customer_id) {
            let query = {"customer_id":req.query.customer_id}
            orderCollection.find(query,{projection:{_id:0}}).toArray()
                .then(textSearchRes => {
                    const page = parseInt(req.query.page);
                    const limit = parseInt(req.query.limit);
                    const startIndex = (page - 1) * limit;
                    const endIndex = page * limit;
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = textSearchRes.length;
                    textSearchRes = textSearchRes.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit },"data": { "orders": textSearchRes } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
        }
        else {
            const page = parseInt(req.query.page);
            const limit = parseInt(req.query.limit);
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            orderCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = results.length;
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "data": { "orders": results } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
        }
    }

    //without pagination
    else{
        if (req.query.customer_id) {
            let query = {"customer_id":req.query.customer_id}
            orderCollection.find(query, { projection: { _id: 0 } }).sort({_id:-1}).toArray()
                    .then(results => {
                        // set the header and status
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 200;
                        res.send(JSON.stringify({"response_desc": "Operation Successful","data": { "orders": results }}));
                    }).catch(error =>{
                        console.log(error);
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode =500;
                        res.json({ "response_desc": "Internal Server Error"});
                });
        }
        else{
            orderCollection.find({}, { projection: { _id: 0 } }).toArray()
            .then(results => {
                // set the header and status
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send(JSON.stringify({"response_desc": "Operation Successful","data": { "orders": results }}));
            }).catch(error =>{
                console.log(error);
                res.setHeader('content-type', 'Application/json');
                res.statusCode =500;
                res.json({ "response_desc": "Internal Server Error"});
            });
        }
    }
}

async function publishOrderStatus(channelName,eventName, orderStatus){
    const realTimeNotificationChannel = ably.channels.get(channelName)
    await realTimeNotificationChannel.publish(eventName, orderStatus)
}

async function handleShowVerificationId(customerId,res,customerCollection){
    let query= { "customer_id":customerId};
    let verificationResult=[]
    await customerCollection.find(query,{projection:{_id:0,phone_number:0,customer_name:0,customer_email:0,location:0,stripe_id:0}}).toArray().then(results=>{
        if(results.length>0){
            if(results[0].id_proof.front==""){
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 404;
                res.send({"response_desc": "Image Not Uploaded"}); 
            }
            else{
                verificationResult=results;
            }
        }
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode = 404;
            res.send({"resp_desc":"Verification Details Not Found"}); 
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });

    //get the images from s3
    let images=["front","back"];
    let imageData=[];
    for(let i=0;i<images.length;i++){
        let file_name=customerId+images[i];
        let getParams = {
            Bucket: idProofBucket, // your bucket name,
            Key: file_name// path to the object you're looking for
        }
        await s3bucket.getObject(getParams, function(err, data) {
            if (err){
                console.log(err)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 400;
                res.send(JSON.stringify({ "response_desc": "Read Operation Failed"}));
            }
            else{
                imageData.push(data.Body.toString('base64'));
                if(imageData.length==images.length){
                    verificationResult[0].id_proof.front=imageData[0];
                    verificationResult[0].id_proof.back=imageData[1];
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({ "response_desc": "Operation successful", "data": verificationResult}));
                }
            } 
        });
    }
}


function handleCreateMessage(req,res,messageCollection){
    messageCollection.insertOne(req.body).then((result,error)=>{
        if(error){
            console.log(error);
            res.setHeader("content-type","Application/json");
            res.statusCode=400;
            res.send({"resp_desc":"Message Creation Failed"});
        }
        else{
            res.setHeader("content-type","Application/json");
            res.statusCode=201;
            res.send({"resp_desc":"Message Sent"});
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
});
}

function handleShowMessage(req,res,messageCollection){
    if(req.query.page){
        if (req.query.search) {
            let s = req.query.search;
            messageCollection.find({
                $or: [
                    { customer_id: new RegExp(s, "i") },
                ]
            },{projection:{_id:0}}).toArray()
                .then(textSearchRes => {
                    const page = parseInt(req.query.page);
                    const limit = parseInt(req.query.limit);
                    const startIndex = (page - 1) * limit;
                    const endIndex = page * limit;
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = textSearchRes.length;
                    textSearchRes = textSearchRes.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit },"data": { "messages": textSearchRes } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
        }
        else {
            const page = parseInt(req.query.page);
            const limit = parseInt(req.query.limit);
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            messageCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    let resultsCount = results.length;
                    results = results.slice(startIndex, endIndex);
                    res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit }, "data": { "messages": results } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
        }
    }
    else{
        messageCollection.find({}, { projection: { _id: 0 } }).toArray()
                .then(results => {
                    // set the header and status
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode = 200;
                    res.send(JSON.stringify({"response_desc": "Operation Successful","data": { "messages": results }}));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
            });
    }
}

//function to verify the vehicle code
function handleVerifyVehicleCode(req,res,orderCollection,inventoryCollection,serviceproviderCollection){
    //both qr_code value and verification number are stored as the string we can use below function for verifying both.
    let query={"order_id":req.body.order_id};
    orderCollection.find(query,{projection:{_id:0}}).toArray().then(result=>{
        if(result.length > 0){
            let code = result[0].bot_id.substr(result[0].bot_id.length - 4)
            if(req.body.verification_code == code){
                handleInventoryDepletion(result[0].products,result[0].bot_id,inventoryCollection,serviceproviderCollection)
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 200;
                res.send({"response_desc":"Vehicle Verified"});
            } else {
                res.setHeader('content-type', 'Application/json');
                res.statusCode = 400;
                res.send({"response_desc":"Incorrect Number"});
            }
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

async function handleSearchProducts(req,res,productsCollection,inventoryCollection,botCollection){
    let userLocation = {}
    let coordinates = []
    let searchQuery = {}
    let inventoryProducts = []
    let serviceProvidersProducts = []
    let s = ''
    //with pagination
    if(req.query.page){
                let s=req.query.search;
                productsCollection.find({$or: [
                    { product_name: new RegExp(s, "i") },
                    {type_of_product:new RegExp(s, "i")}
                ]},{projection: {_id:0}}).toArray().then(result=>{
                        res.setHeader('content-type', 'Application/json');
                        res.statusCode = 200;
                        let resultsCount = result.length;
                        result = result.slice(startIndex, endIndex);
                        res.send(JSON.stringify({"response_desc": "Operation Successful", "pagination": { "currentPage": page, "totalRecords": resultsCount, "perPage": limit },"data": { "products": result } }));
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
            }
    //without pagination
    else{
        if(req.query.location){
            coordinates = req.query.location.split(',')

            userLocation = {latitude: parseFloat(coordinates[0]), longitude: parseFloat(coordinates[1])}
            await botCollection.find({}).toArray().then(botsresult=>{
                getAvailableServiceProviders(userLocation, botsresult)
                  .then(availableServiceProviders=>{
                      res.setHeader('content-type', 'Application/json');
                      res.statusCode =200;
                      res.json({ "response_desc": "Operation Successful", data:{service_providers: availableServiceProviders}}); 
                }).catch(error=>{
                    console.log(error)
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =200;
                    res.json({ "response_desc": "Internal Server Error"});
                })
            })
        }
        else if(req.query.service_provider){
            if(req.query.search){
                s = req.query.search
                searchQuery = {
                    $and:[{service_provider: req.query.service_provider}],
                    $or: [
                        {product_id: new RegExp(s, "i") },
                        {product_name: new RegExp(s, "i") },
                        {type_of_product: new RegExp(s, "i")}
                    ]
                }
            }
            else{
                searchQuery = {service_provider: req.query.service_provider}
            }

            await inventoryCollection.find(searchQuery,{projection:{_id:0}}).toArray().then(inventorySearchResults=>{
                inventoryProducts = inventorySearchResults
            }).catch(error=>{
                console.log(error)
                res.setHeader('content-type', 'Application/json');
                res.statusCode =200;
                res.json({ "response_desc": "Internal Server Error"});
            })
            
            //get products details from product collection
            await getProductDetails(inventoryProducts,productsCollection,function(error, serviceProvidersProducts){
                if(error){
                    console.log(error)
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =200;
                    res.json({ "response_desc": "Internal Server Error"});
                }
                else{
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =200;
                    res.json({ "response_desc": "Operation Successful", data:{products: serviceProvidersProducts}});
                }
            })
            
            
        }
        else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode =400;
            res.json({ "response_desc": "Invalid Request"}); 
        }
    }
}

async function getAvailableServiceProviders(userLocation,bots){
    let botLocation = {}
    let availableServiceProviders = []
    let serviceLocation = []
    for (let i = 0; i < bots.length; i++) {
        let serviceProvider = {}
        serviceLocation = bots[i].area_of_service.split(',')
        botLocation = {latitude:parseFloat(serviceLocation[0]) ,longitude:parseFloat(serviceLocation[1])}
        if (geolib.isPointWithinRadius(userLocation, botLocation, parseInt(serviceLocation[2]))) {
            serviceProvider.service_provider_name = bots[i].associated_service_provider
            availableServiceProviders.push(serviceProvider)
        }
      }
    return availableServiceProviders
}

async function getProductDetails(inventoryProductSearchResults,productsCollection, callback){
let ServiceProvidersproducts=[];
let product = []

for(let i=0; i< inventoryProductSearchResults.length; i++){
    let findquery={"product_id":inventoryProductSearchResults[i].product_id};
    await productsCollection.find(findquery,{projection:{_id:0}}).toArray().then(result =>{
        product = result
    });
    if(product.length>0){
        product[0].inventory_id = inventoryProductSearchResults[i].inventory_id
        product[0].quantity = inventoryProductSearchResults[i].quantity
        product[0].bot_id = inventoryProductSearchResults[i].bot_id
        ServiceProvidersproducts.push(product[0]);
    }
}
 callback(null,ServiceProvidersproducts)
}

async function handleGetProductBrief(res,productsCollection){

    await productsCollection.find({},{projection:{_id:0,type_of_product:0,flavour_variation:0,quantity:0,package_type:0,price:0,tax:0,delivery:0}}).toArray().then(results=>{
        res.setHeader('content-type', 'Application/json');
        res.statusCode = 200;
        res.send(JSON.stringify({"response_desc": "Operation Successful","data": { "products": results } }));
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
    
}

async function createStripeCustomer(customer){
    console.log('called')
    let stripeCustomer = await stripe.customers.create({
          name: customer.customer_name,
          email: customer.customer_email
      });
    return stripeCustomer.id
}

async function handleCreatePaymentIntent(req,res,customerCollection,orderCollection,botCollection){
    let query={"customer_id":req.body.customer_id};
    let result=[]
    let amount = parseInt(req.body.total_amount*100); //stripe always takes amount in cents, for example 1.0 will be 1cents
    await customerCollection.find(query,{projection:{_id:0}}).toArray().then(async results=>{
        if(results.length>0){
            if(results[0].stripe_id == ""){
                results[0].stripe_id = await createStripeCustomer(results[0])
                await customerCollection.updateOne(query,{$set:{stripe_id:results[0].stripe_id}})
            }
            result=results;    
        } else {
            res.setHeader('content-type', 'Application/json');
            res.statusCode =404;
            res.json({ "response_desc": "Customer Not Found"});
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });

    try {
        const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: result[0].stripe_id },
            { apiVersion: '2020-08-27' }
        );
        // Create the PaymentIntent
        let intent = await stripe.paymentIntents.create({
              amount: amount,
              currency: 'usd',
              customer: result[0].stripe_id,
              description:"Payment Request for the order "+req.body.order_id+" by the customer "+result[0].customer_name
        });
        let updateData={"order_status":"order_initiated",payment:{'payment_id':intent.id,"payment_status":"payment_initiated"}}
        await handleUpdatePaymentStatus(req.body.order_id,updateData,orderCollection,customerCollection,botCollection);

        res.setHeader('content-type', 'Application/json');
        res.statusCode =200;
        res.json({"response_desc": "Payment Intent Created Successfully",paymentIntent: intent.client_secret,ephemeralKey: ephemeralKey.secret,customer: result[0].stripe_id})
        
  }
  catch (e) {
      // Display error on client
      console.log(e)
      res.setHeader('content-type', 'Application/json');
      res.statusCode =500;
      res.send({"response_desc": "Internal Server Error" });
  }
}

//this function will be call after the authentication is successful
async function handleConfirmPaymentIntent(req,res,orderCollection,customerCollection,botCollection){
    let intentId=req.body.intent_id;
    let updateData={"order_status":"order_confirmed",payment:{'payment_id':intentId,"payment_status":"payment_confirmed"}}
    await handleUpdatePaymentStatus(req.body.order_id,updateData,orderCollection,customerCollection,botCollection);
    res.setHeader('content-type', 'Application/json');
    res.statusCode =200;
    res.json({ "response_desc": "Payment Successful"});
}


//update payment status
async function handleUpdatePaymentStatus(orderId,updateData,orderCollection,customerCollection,botCollection){
    let query={'order_id':orderId};
    let data={$set:{"order_status":updateData.order_status,"payment":updateData.payment}};
    await orderCollection.updateOne(query,data).then((result,error)=>{
        if(updateData.order_status == "order_confirmed"){
            let messagePayload = {
                'message_id': null,
                'service_order_id':orderId,
                'customer_id':null,
                'customer_name':null,
                'service_provider':null,
                'fulfillment_location':null,
                'bot_id':null,
                'event_id' : null,
                'timestamp' : Math.floor((new Date()).getTime() / 1000),
            }
            orderCollection.find({'order_id':orderId},{}).toArray().then(async result=>{
                if(result.length>0){
                    let customerId = result[0].customer_id
                    messagePayload.bot_id = result[0].bot_id
            
                    await customerCollection.find({customer_id:customerId},{}).toArray().then(customer=>{
                        if(customer.length>0){
                            messagePayload.customer_name = customer[0].customer_name
                            messagePayload.fulfillment_location = customer[0].location.lat+' '+customer[0].location.long
                            messagePayload.customer_id = customer[0].customer_id
                        }
                    })

                    await botCollection.find({'bot_id':result[0].bot_id}).toArray().then(bot=>{
                        if(bot.length>0){
                            messagePayload.service_provider = bot[0].associated_service_provider
                        }
                    })


                }
                //publish message to server Manager
                publishOrderStatus(serverManageApiGatewayChannel,broadCastEvent,messagePayload)
            })
            
        }
    })
}


async function handleCreateRefund(req,res,orderCollection){
    let query={"order_id":req.body.order_id};
    await orderCollection.find(query,{projection:{_id:0}}).toArray().then(results=>{
        if(results.length>0){
            stripe.refunds.create({
                charge: results[0].payment.payment_id,
              }).then(refund=>{
                if(refund.status=="succeeded"){
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =200;
                    res.json({"response_desc":"Refund Processed Successful",payment:{"payment_id":results[0].payment.payment_id,"payment_status":"Refund Processed"}});
                }
                else{
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.end({"response_desc":"Refund Was Not Processed",payment:{"payment_id":results[0].payment.payment_id,"payment_status":"Refund Cancelled"}});
                    
                }
                }).catch(error =>{
                    console.log(error);
                    res.setHeader('content-type', 'Application/json');
                    res.statusCode =500;
                    res.json({ "response_desc": "Internal Server Error"});
                });
            }
            
        else{
            res.setHeader('content-type', 'Application/json');
            res.statusCode =404;
            res.json({ "response_desc": "Order Not Found"});
        }
    }).catch(error =>{
        console.log(error);
        res.setHeader('content-type', 'Application/json');
        res.statusCode =500;
        res.json({ "response_desc": "Internal Server Error"});
    });
}

async function handleCustomerIdVerification(req,res,customerCollection){
    if(req.body.id_proof.front=="" || req.body.id_proof.back==""){
        res.setHeader('content-type', 'Application/json');
        res.statusCode =400;
        res.json({ "response_desc": "Image Missing In Request"});
    }
    else{
        let images=[{"front":req.body.id_proof.front},{"back":req.body.id_proof.back}];
        let imageData=[];
        images.forEach((obj) => {
            let key=Object.keys(obj)[0];
            let content=Buffer.from(obj[key].replace(/^data:image\/\w+;base64,/, ""),'base64')
            const params = {
            Bucket: idProofBucket,
            Key: req.params.customer_id+key,
            Body: content,
        };
        s3bucket.upload(params,function(err,data){
                if(err){
                    es.setHeader('content-type', 'Application/json');
                    res.statusCode =400;
                    res.json({ "response_desc": "Image Uploading Failed"});
                } else {
                    imageData.push(data.Location);
                    if(imageData.length == images.length){
                        let datas={}
                        datas.id_proof={};
                        datas.id_proof.front=imageData[0];
                        datas.id_proof.back=imageData[1];
                        datas.id_proof.verification_status=req.body.id_proof.verification_status;
                        customerCollection.updateOne({'customer_id':req.params.customer_id},{$set:datas}).then((result,error)=>{
                            if(error){
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode =400;
                                res.json({ "response_desc": "User Updation Failed"});
                            } else {
                                res.setHeader('content-type', 'Application/json');
                                res.statusCode =201;
                                res.json({ "response_desc": "User Updated Successful"});
                            }   
                        });
                    }
                }
            });
            
        });
    }
}

async function handleUpdateOrderStatus(data,orderCollection){
    let messagePayload = {}
    let orderId = data.service_order_id;
    let orderStatus = data.order_status
    let serviceState = data.service_state
    updateData = {}
    if(orderStatus!==null){
        updateData.order_status = orderStatus
    }
    if(serviceState!==null){
        updateData.service_state = serviceState
    }
    const QueryToUpdateOrder = {'order_id':orderId}
    const ApiGatewayToAppChannel = 'api_gateway_'+orderId;

    await orderCollection.updateOne(QueryToUpdateOrder,{$set:updateData}).then((result,error)=>{
        if(result){
            messagePayload.order_status = orderStatus
            //publish message to App
            publishOrderStatus(ApiGatewayToAppChannel,orderUpdateEvent,messagePayload)
        }
    })
}
