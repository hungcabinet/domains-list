import openCkk from "./providers/iplistOpenckk.js";
import metaCube from "./providers/metaCubeGeosite.js";
import v2fly from "./providers/v2fly.js";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {fetchUrlStringWithRetry} from "./urls.js";
import {filterDomains} from "./utils.js";

const providers = [
    openCkk,
    metaCube,
    v2fly
];

const appConfig = {
    maxFileEntries: -1,
    generateCombinedFiles: true,
    generateIndividualFiles: false,
    perServiceTemplate: undefined,
    domainTemplate: "{{domain}} #{{service}}\n",
    fileExtension: "lst",
    groups: [],
    services: []
}

const allFilesPath = path.resolve(`./lists/.generated_files`);

let combinedFileData = undefined;
let serviceFileData = new Map();
let allFiles = [];

function createNewFileData(fileName){
    return {
        includedDomains:[],
        fileName:fileName,
        isPartitioned: appConfig.maxFileEntries > 0,
        partition: 0,
        entries: 0,
        isNewPartition: true,
        additionalLists:{}
    };
}

function pushDomainToSpecificFile(service, domain, fileData){
    let fileName = `${fileData.fileName}`;
    if (fileData.isPartitioned){
        fileName += `_${fileData.partition}`
    }
    if ((appConfig.fileExtension ?? "") !== ""){
        fileName += `.${appConfig.fileExtension}`;
    }

    let filePath = path.resolve(`./lists/${fileName}`);

    if (!fileData.includedDomains.includes(domain)){
        if (fileData.isNewPartition){
            allFiles.push(fileName);

            fs.writeFileSync(filePath, "");

            if ((appConfig.perServiceTemplate ?? "") !== ""){
                let serviceContent = appConfig.perServiceTemplate.replace("{{service}}", service);
                fs.appendFileSync(filePath, serviceContent);
            }
        }

        let domainContent = appConfig.domainTemplate.replace("{{domain}}", domain).replace("{{service}}", service);
        fs.appendFileSync(filePath, domainContent);

        fileData.includedDomains.push(domain);

        if (!fileData.isPartitioned){
            fileData.isNewPartition = false;
        }
        else{
            fileData.entries++;
            if (fileData.entries >= appConfig.maxFileEntries){
                fileData.isNewPartition = true;
                fileData.partition++;
                fileData.entries = 0;
            }
            else{
                fileData.isNewPartition = false;
            }
        }
    }
}

function pushDomainToFiles(service, domain){

    console.log(`Add service ${service} (${domain}) to files`);

    if (appConfig.generateCombinedFiles){
        pushDomainToSpecificFile(service, domain, combinedFileData);
    }

    if (appConfig.generateIndividualFiles){
        if (!serviceFileData.has(service)){
            serviceFileData.set(service, createNewFileData(service));
        }
        pushDomainToSpecificFile(service, domain, serviceFileData.get(service));
    }
}

async function init(){

    const configPath = process.env["CONFIG_PATH"];
    if (!configPath) throw new Error('CONFIG_PATH not defined');

    const content = fs.readFileSync(path.resolve(configPath));
    let confData = JSON.parse(content);

    for (let key in confData) {
        appConfig[key] = confData[key];
    }

    for (const provider of providers) {
        await provider.init();
    }

    fs.writeFileSync(allFilesPath, "");
    combinedFileData = createNewFileData("_all_in_one");
}

async function processService(service){
    let serviceDomains = [];

    for (const provider of providers) {
        await provider.getDomainsForService(service, serviceDomains);
    }

    for (const domain of serviceDomains) {
        pushDomainToFiles(service, domain);
    }
}

async function processAdditionalLists(){
    if (appConfig.additionalLists === undefined ){
        return;
    }

    for (const service in appConfig.additionalLists) {
        let list = appConfig.additionalLists[service];

        for (let item of list){
            let text = await fetchUrlStringWithRetry(item);
            let domains = text.split("\n").map(line => line.trim());
            domains = filterDomains(domains);

            for (let domain of domains)
            {
                pushDomainToFiles(`_${service}`, domain);
            }
        }
    }
}

async function run(){
    dotenv.config();
    await init();

    let targetServices = [...appConfig.services];
    let targetGroups = [...appConfig.groups];

    for (const group of targetGroups) {
        for (const provider of providers) {
            await provider.getServicesForGroup(group, targetServices);
        }
    }

    for (const service of targetServices) {
        await processService(service);
    }

    await processAdditionalLists();

    allFiles = allFiles.sort();

    for (const file of allFiles) {
        fs.appendFileSync(allFilesPath, `${file}\n`);
    }

    const files = await fs.readdirSync("./lists");


    for (const file of files) {
        if (file !== ".generated_files" && !allFiles.includes(file)){
            fs.unlinkSync(path.join("./lists", file));
        }
    }
}

run().catch(console.error);