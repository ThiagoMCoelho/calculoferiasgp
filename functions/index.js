const functions = require("firebase-functions");

const puppeteer = require('puppeteer');

const cheerio = require('cheerio');

const cheerioTableparser = require('cheerio-tableparser')

const express = require('express');


const timeout = require('connect-timeout')

const app = express();

app.set("view engine", "ejs");
app.set("views", "./");

app.use(timeout(300000))


var risco12meses = 0;
var noturno12meses = 0;
var cincporcento12meses = 0;
var cemporcento12meses = 0;
var riscoPeriodo = 0;
var noturnoPeriodo = 0;
var cincporcentoPeriodo = 0;
var cemporcentoPeriodo = 0;
var salarioFerias;
var noturnoFerias = 0.0;
var riscoFerias = 0.0;
var cemFerias = 0.0;
var cincFerias = 0.0;
var repremFerias = 0.0;
var atsFerias = 0.0;
var extraPeriodoAquisitivoPeriodo = 0.0;
var extraPeriodoAquisitivo12meses = 0.0;
var adiantamentodeFerias = 0.0;
var gratificacaoFerias = 0.0;
var abonoPecuniario = 0.0;
var erro = false;

function calculaExtraPeriodoAquisivo(noturno, risco, cem, cinquenta){
    noturnoFerias = ((salarioFerias+atsFerias)/180)*Math.round(noturno/12)*0.5
    riscoFerias = (salarioFerias/180)*Math.round(risco/12)*0.4
    cemFerias = ((noturnoFerias+atsFerias+salarioFerias)/180)*Math.round(cem/12)*2
    cincFerias = ((noturnoFerias+atsFerias+salarioFerias)/180)*Math.round(cinquenta/12)*1.5
    repremFerias = (cemFerias+cincFerias)/6
    extraPeriodoAquisitivo = noturnoFerias + riscoFerias + cincFerias + cemFerias + repremFerias
    return extraPeriodoAquisitivo;
}

function trocarPontoeVirgula(valor){
    var semPonto = valor.toString().replace(".","")
    return semPonto.replace(",",".")
}

function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function dadosdasFerias(contracheque){
    var ccFerias
    const $ =cheerio.load(contracheque);
    cheerioTableparser($)
    $('body table').each((i, el) => {
        ccFerias = $(el).parsetable();
        if (i === 0) {return true}
        ccFerias.forEach((colunaDescricao, cdIndex, cdArray) => {
            if (cdIndex != 0) { return true }
            colunaDescricao.forEach((colunaDescricao2, cdIndex2, cdArray2) => {
                if (colunaDescricao2.includes("SALARIO")){
                    salarioFerias = Number.parseFloat(trocarPontoeVirgula(ccFerias[2][cdIndex2]));
                }
                if (colunaDescricao2.includes("TEMPO SERVICO")){
                    atsFerias = Number.parseFloat(trocarPontoeVirgula(ccFerias[2][cdIndex2]))
                }
                if (colunaDescricao2.includes("REM.REP.")){
                    repremFerias = Number.parseFloat(trocarPontoeVirgula(ccFerias[2][cdIndex2]))
                }
            });
        });
    });
    adiantamentodeFerias = (salarioFerias + atsFerias)*0.3;
}

function calculamedias12meses(contracheque){
    var cc
    const $ = cheerio.load(contracheque);
    cheerioTableparser($)
    $('body table').each((i, el) => {
        cc = $(el).parsetable();
        if (i === 0) { return true };
        cc.forEach((element, index, array) => {
            if (index != 0) {return true}
            element.forEach((colunaDescricao, cdIndex, cdArray) => {
                if (colunaDescricao.includes("50")){
                    if(isNumeric((cc[1][cdIndex]))){
                        cincporcento12meses += Number.parseInt(cc[1][cdIndex])
                    } 
                }
                if (colunaDescricao.includes("100") || colunaDescricao == ""){
                    if(isNumeric((cc[1][cdIndex]))){
                        cemporcento12meses += Number.parseInt(cc[1][cdIndex])
                    } 
                }
                if (colunaDescricao.includes("RISCO")){
                    if(isNumeric((cc[1][cdIndex]))){
                        risco12meses += Number.parseInt(cc[1][cdIndex])
                    } 
                }
                if (colunaDescricao.includes("NOTURNO")){
                    if(isNumeric((cc[1][cdIndex]))){
                        noturno12meses += Number.parseInt(cc[1][cdIndex])
                    } 
                }
            });
        });
    });
}

function calculamediasPeriodoAquisitivo(contracheque){
    var cc
    const $ = cheerio.load(contracheque);
    cheerioTableparser($)
    $('body table').each((i, el) => {
        cc = $(el).parsetable();
        if (i === 0) { return true };
        cc.forEach((element, index, array) => {
            if (index != 0) {return true}
            element.forEach((colunaDescricao, cdIndex, cdArray) => {
                if (colunaDescricao.includes("50")){
                    if(isNumeric((cc[1][cdIndex]))){
                        cincporcentoPeriodo += Number.parseInt(cc[1][cdIndex])
                    } 
                }
                if (colunaDescricao.includes("100") || colunaDescricao == ""){
                    if(isNumeric((cc[1][cdIndex]))){
                        cemporcentoPeriodo += Number.parseInt(cc[1][cdIndex])
                        console.log(cc[1][cdIndex]);
                    } 
                }
                if (colunaDescricao.includes("RISCO")){
                    if(isNumeric((cc[1][cdIndex]))){
                        riscoPeriodo += Number.parseInt(cc[1][cdIndex])
                    } 
                }
                if (colunaDescricao.includes("NOTURNO")){
                    if(isNumeric((cc[1][cdIndex]))){
                        noturnoPeriodo += Number.parseInt(cc[1][cdIndex])
                    } 
                }
            });
        });
    });
}

app.get('/', (req, res) => {
    res.render('home');
})

app.get('/teste', (req, res) => {
    res.render('teste')
})

app.post('/calcular', async (req, res) => {
    const { login_intranet, senha_intranet, mes_ferias, periodo_aquisitivo} = req.body;

  const browser = await puppeteer.launch({headless: true,
    args: ['--single-process', '--no-zygote', '--no-sandbox']});
  const browserWSEndpoint = await browser.wsEndpoint()
  const page = await browser.newPage();
  await page.setViewport({width: 1200, height: 720});
  await page.goto('http://intranet.portosrio.gov.br/', { waitUntil: 'load' }); // wait until page load
  await page.type('[name="identity"]', login_intranet);
  await page.type('[name="password"]', senha_intranet);
  // click and wait for navigation
  await Promise.all([
    page.click('[name="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
  ]).catch(function(error){
      console.log(error);
  });
  await page.goto('http://intranet.portosrio.gov.br/rh/vencimentos/login'), { waitUntil: 'domcontentloaded' };
  await page.type('[name="username"]', login_intranet)
  .catch(function(errorr){
      console.log("entrou no erro1")
        erro = true;
  });
  await page.type('[name="password"]', senha_intranet);
  await Promise.all([
    page.click('[name="submit"]'),
    page.waitForNavigation({ waitUntil: 'load' }),
  ]).catch(function(error){
      console.log(error);
  });
  const grupos = await page.evaluate( () => Array.from( document.querySelectorAll( 'a' ), element => element.href) );
  for (var i=0; i < grupos.length; i++){
        if (grupos[i].includes(mes_ferias)){
            for (var j=i; j < i+14; j++){
                const browser2 = await puppeteer.connect({ browserWSEndpoint })
                const page2 = await browser2.newPage()
                await page2.goto(grupos[j], {waitUntil: 'domcontentloaded'});
                const contracheque = await page2.content()
                if (grupos[j].includes(mes_ferias)){
                    dadosdasFerias(contracheque)
                }
                calculamedias12meses(contracheque)
                await page2.goto('about:blank')
                await page2.close()
                await browser2.disconnect()
            }
            
        }
        if (grupos[i].includes(periodo_aquisitivo)){
            for (var k=i; k < i+14; k++){
                const browser2 = await puppeteer.connect({ browserWSEndpoint })
                const page2 = await browser2.newPage()
                await page2.goto(grupos[k], {waitUntil: 'domcontentloaded'});
                const contracheque = await page2.content()
                calculamediasPeriodoAquisitivo(contracheque)
                await page2.goto('about:blank')
                await page2.close()
                await browser2.disconnect()
            }
            
        }
  }
  await page.close()
  await browser.disconnect()

  extraPeriodoAquisitivo12meses = calculaExtraPeriodoAquisivo(noturno12meses, risco12meses, cemporcento12meses, cincporcento12meses);
  extraPeriodoAquisitivoPeriodo = calculaExtraPeriodoAquisivo(noturnoPeriodo, riscoPeriodo, cemporcentoPeriodo, cincporcentoPeriodo);
  if (extraPeriodoAquisitivo12meses > extraPeriodoAquisitivoPeriodo){
            if (erro){
                res.redirect('/')
            }else{
                gratificacaoFerias = (extraPeriodoAquisitivo12meses + salarioFerias + atsFerias)/2
                abonoPecuniario = (gratificacaoFerias);
                res.render('result', {cc: { mediaRisco: Math.round(risco12meses/12), mediaNoturno: Math.round(noturno12meses/12),
                  mediaCem: Math.round(cemporcento12meses/12),
                  mediaCinquenta: Math.round(cincporcento12meses/12),
                  extraPeriodoAquisitivo: (Math.round(extraPeriodoAquisitivo12meses*100)/100),
                  adiantamentodeFerias: (Math.round(adiantamentodeFerias*100)/100),
                  gratificacaodeFerias: (Math.round(gratificacaoFerias*100)/100),
                  abonoPecuniario: (Math.round(abonoPecuniario*100)/100),
                  metodo: "Últimos 12 meses!"
               }});
            
            }
        }else{
            if (erro){
                res.redirect('/')
            }else{
                gratificacaoFerias = (extraPeriodoAquisitivoPeriodo + salarioFerias + atsFerias)/2
                abonoPecuniario = (gratificacaoFerias);
              res.render('result', {cc: { mediaRisco: Math.round(riscoPeriodo/12), mediaNoturno: Math.round(noturnoPeriodo/12),
                  mediaCem: Math.round(cemporcentoPeriodo/12),
                  mediaCinquenta: Math.round(cincporcentoPeriodo/12),
                  extraPeriodoAquisitivo: (Math.round(extraPeriodoAquisitivoPeriodo*100)/100),
                  adiantamentodeFerias: (Math.round(adiantamentodeFerias*100)/100),
                  gratificacaodeFerias: (Math.round(gratificacaoFerias*100)/100),
                  abonoPecuniario: (Math.round(abonoPecuniario*100)/100),
                  metodo: "Período Aquisitivo!"
               }});
            
            }
        }
  console.log(Math.round(cincporcento12meses/12) + " " + Math.round(cemporcento12meses/12) + " " + Math.round(risco12meses/12) + " " + Math.round(noturno12meses/12) + " 12 meses")
  console.log(Math.round(cincporcentoPeriodo/12) + " " + Math.round(cemporcentoPeriodo/12) + " " + Math.round(riscoPeriodo/12) + " " + Math.round(noturnoPeriodo/12) + " periodo aquisitivo")
        console.log(calculaExtraPeriodoAquisivo(noturno12meses, risco12meses, cemporcento12meses, cincporcento12meses))
        console.log(calculaExtraPeriodoAquisivo(noturnoPeriodo, riscoPeriodo, cemporcentoPeriodo, cincporcentoPeriodo))
});

exports.app = functions.https.onRequest(app);