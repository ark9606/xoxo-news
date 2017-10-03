'use strict';
let express = require('express');
let router = express.Router();

const Promise = require('bluebird');
const jsdom = require('jsdom');
const request = Promise.promisifyAll(require('request'), {multiArgs: true});
const { JSDOM } = jsdom;
const fs = require('fs');

let cron = require('node-cron');

let badWords = ['страйк','помер','вбив','вбил','епідем','пожеж','чум','вибух','горів','смерт','п\'ян','вкрав','гвалт','жертв','страх','бомб','збро','ядерн','стражд','мучив','злодій','злочин','крадіж','горінн','стріл','дтп','банд','напав','напала','напали','підстрел','поране','диверс'];

// объект строк запросов
let source = {

  'Korr' : {
    'Політика': [
      'http://ua.korrespondent.net/ukraine/politics/'
    ],
    'Економіка' : [
      'http://ua.korrespondent.net/business/economics/'
    ],
    'Наука' :['http://ua.korrespondent.net/tech/science/'],
    'Медицина' :['http://ua.korrespondent.net/tech/medicine/'],
    'Фінанси' : ['http://ua.korrespondent.net/business/financial/'],
    'Нерухомість' : ['http://ua.korrespondent.net/business/realestate/'],
    'Авто' : ['http://ua.korrespondent.net/business/auto/'],
    'Культура' : ['http://ua.korrespondent.net/showbiz/culture/'],
    'Кіно' : ['http://ua.korrespondent.net/showbiz/cinema/'],
    'Музика' : ['http://ua.korrespondent.net/showbiz/music/'],
    'Технології' : ['http://ua.korrespondent.net/business/web/'],
    'Спорт' : ['http://ua.korrespondent.net/sport/football/', 'http://ua.korrespondent.net/sport/boks/', 'http://ua.korrespondent.net/sport/basketball/']
  },
  'RBC': {
   'Політика': [
   'https://www.rbc.ua/ukr/politics'
   ],
   'Економіка': [
   'https://www.rbc.ua/ukr/economic',
   ],
   'Суспільство': ['https://www.rbc.ua/ukr/society'],
   'Події': ['https://www.rbc.ua/ukr/accidents'],
   'Фінанси': ['https://www.rbc.ua/ukr/finance'],
   'Нерухомість': ['https://www.rbc.ua/ukr/realt'],
   'Туризм': ['https://www.rbc.ua/rus/tourism']
   },
  'Cen':{
    'Політика': [
      'https://ua.censor.net.ua/news/all/page/1/category/101/interval/5/sortby/date'
    ],
    'Спорт': ['https://ua.censor.net.ua/news/all/page/1/category/108/interval/5/sortby/date'],
    'Авто':['https://ua.censor.net.ua/news/all/page/1/category/374/interval/5/sortby/date'],
    'Здоров\'я' : ['https://ua.censor.net.ua/news/all/page/1/category/111/interval/5/sortby/date'],
    'Економіка': ['https://ua.censor.net.ua/news/all/page/1/category/102/interval/5/sortby/date'],
    'Технології':['https://ua.censor.net.ua/news/all/page/1/category/112/interval/5/sortby/date'],
    'Суспільство': ['https://ua.censor.net.ua/news/all/page/1/category/107/interval/5/sortby/date']
  },
  'Gord' : {
    'Політика': [
      'http://gordonua.com/ukr/news/politics.html'
    ],
    'Фінанси': ['http://gordonua.com/ukr/news/money.html'],
    'Культура': [ 'http://gordonua.com/ukr/news/culture.html'],
    'Спорт': ['http://gordonua.com/ukr/news/sport.html']
  }

};

let myImages = ['images/news.jpg', 'images/news1.jpg', 'images/news2.jpg', 'images/news3.jpg', 'images/news4.jpg'];

// массив всех новостей
// let data = {};
let allCategories = [];

// все новости - копия файла news.json
let allNews = {};

// массив всех запросов
let urls = [];
for(let site in source){
  // data[site] = [];
  for(let cat in source[site]){
    urls = urls.concat(source[site][cat].map((url) => {return { site, cat, url}}));
    if(!allCategories.includes(cat))
      allCategories.push(cat);
  }
}

const START_COUNT_NEWS = 21;
const ADD_COUNT_NEWS = 10;

// начальное получение всех новостей
startGetAllNews(urls);

// каждый 1 min проверяем на наличие новых новостей
cron.schedule('0 */1 * * * *', function(){
  getRecentNews(urls);
});

// делаем запрос сами себе каждые 8 минут, что бы сервер на хероку не сдох
cron.schedule('0 */8 * * * *', function(){
  request("https://xoxo-news.herokuapp.com/hook", function (err0, req_res, body) {
  // request("http://localhost:3000/hook", function (err0, req_res, body) {
    if (err0) {
      console.error(err0);
      return;    }
    console.log('Callback :' + body);
  });
});

// массив пользователей
let users = [];

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile('index.html');
});

router.get('/news', function(req, res, next) {

  // добавляем пользователя в массив
  let user = {
    id: req.session.id,
    seens : 0
  };
  if(users.filter((u)=> u.id === user.id).length !== 0){
    users = users.filter((u)=> u.id !== user.id);
  }
  users.push(user);

  // делаем выборку по START_COUNT_NEWS новостей из каждой категории
  let newsForUser = [];
  for(let cat in allNews){
    // newsForUser.push({name: cat, items: allNews[cat].slice(user.seens[cat], user.seens[cat] + START_COUNT_NEWS) });
    newsForUser.push({name: cat, items: allNews[cat].slice(0, START_COUNT_NEWS) });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
  res.setHeader('Access-Control-Allow-Credentials', true); // If needed

  res.send(JSON.stringify(newsForUser));

  // request("http://gordonua.com/ukr/news/politics.html", function (err0, req_res, body) {
  //   if (err0) {
  //     console.error(err0);
  //     return;    }
  //   let m = getNews_Gord(body).filter((e)=> e!== null);
  //   res.render('test', { data: body});
  // });
});

router.get('/hook', function(req, res, next) {
  res.send('hook!');
});

//свежие новости - обновление
router.get('/recent-news/', function(req, res, next) {
  processNewFeeds(urls, res);
});


/** КАТЕГОРИИ */
// начальная загрузка страницы
router.get('/category/:name/:isGood', function(req, res, next) {
  let req_name = req.params['name'];
  let req_isGood = parseInt(req.params['isGood']);
  if (!allCategories.includes(req_name) || (req_isGood !== 0 && req_isGood !== 1 && req_isGood !== -1)){
    res.setHeader('Access-Control-Allow-Origin', '*');
	  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed
    res.send('%none%');
    return;
  }
  // добавляем пользователя в массив
  let user = {
    id: req.session.id,
    seens : 0,
    name : req_name,
    isGood : req_isGood
  };
  if(users.filter((u)=> u.id === user.id).length !== 0){
    users = users.filter((u)=> u.id !== user.id);
  }

  // делаем выборку по START_COUNT_NEWS новостей из заданной категорией и isGood
  let newsForUser = null;
  if (user.isGood === -1)
    newsForUser = {name: req_name, items: allNews[req_name].slice(0, ADD_COUNT_NEWS) };
  else {
    req_isGood = (user.isGood === 1) ? true : false;
    newsForUser = {
      name: req_name,
      items: allNews[req_name].filter((e) => e.isGood === req_isGood).slice(0, ADD_COUNT_NEWS)
    };
  }
  user.seens = ADD_COUNT_NEWS;


  users.push(user);
    res.setHeader('Access-Control-Allow-Origin', '*');
	  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed
    res.send(JSON.stringify(newsForUser));

});

// догрузка новостей
router.get('/category/more', function(req, res, next) {
  let user = users.filter((u)=> u.id === req.session.id)[0];

  // делаем выборку по START_COUNT_NEWS новостей из заданной категорией и isGood
  let newsForUser = null;
  if (user.isGood === -1)
    newsForUser = {name: user.name, items: allNews[user.name].slice(user.seens, user.seens + ADD_COUNT_NEWS) };
  else {
    let req_isGood = (user.isGood === 1) ? true : false;
    newsForUser = {
      name: user.name,
      items: allNews[user.name].filter((e) => e.isGood === req_isGood).slice(user.seens, user.seens + ADD_COUNT_NEWS)
    };
  }
  user.seens += ADD_COUNT_NEWS;
  res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
  res.setHeader('Access-Control-Allow-Credentials', true); // If needed
  res.send(JSON.stringify(newsForUser));
});

// свежие новости по категории - в категории будет
router.get('/category/recent', function(req, res, next) {
  let user = users.filter((u)=> u.id === req.session.id)[0];

  urls = [];
  for(let site in source){
    urls = urls.concat(source[site][user.name].map((url) => {
      return {site, cat: user.name, url}
    }));
  }
  // console.log(urls);
  // res.send('+');
  processNewFeeds_Category(urls, res, user.isGood);
});

function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
function startGetAllNews(source) {
  return Promise.map(source, function (feed) {
    return processUrl({site : feed.site, cat : feed.cat, url : feed.url})
  })
  .then(function (array) {
    let object = {};
    let c = 0;
    for(let i = 0; i < array.length; i++){
      // наполняем объект для файла json
      if(object[array[i].category] === undefined){
        object[array[i].category] = shuffle(array[i].news);
      }
      else {
        object[array[i].category] = object[array[i].category].concat(shuffle(array[i].news));
      }
      c += array[i].news.length;
    }
    // перемешиваем
    for(let cat in object){
      object[cat] = shuffle(object[cat])
    }
    allNews = object;
    fs.writeFileSync("news.json", JSON.stringify(object), { encoding : 'utf8', flag : 'w' });
    console.log('СТАРТ: получено ' + c + ' новостей');
  })
  .catch(function (e) {
    // ERROR
    console.log(e);
  })
}

function getRecentNews(source) {
  return Promise.map(source, function (feed) {
    return processUrl({site : feed.site, cat : feed.cat, url : feed.url})
  })
  .then(function (array) {
    let object = {};
    let c = 0;
    let co = 0;
    // let s = [];
    // проверяем новая ли новость
    // для тестирования data изменим сами
    let oldNews = JSON.parse(fs.readFileSync('news.json', 'utf8'));
    let new_cats = [];
    for(let i = 0; i < array.length; i++){
      // наполняем объект для файла json
      if(object[array[i].category] === undefined){
        object[array[i].category] = array[i].news;
        new_cats.push(array[i].category);
      }
      else {
        object[array[i].category] = object[array[i].category].concat(array[i].news);
      }
      c += array[i].news.length;
    }

    //сравнить два объекта - object (полученные) и oldNews(старые) новости
    let recNews = {};
    for(let k = 0; k < new_cats.length; k++){
      let site = new_cats[k];
      recNews[site] = [];
      for(let i = 0; i < object[site].length; i++) {
        let contains = false;
        for(let j = 0; j < oldNews[site].length; j++){
          if(object[site][i].title === oldNews[site][j].title) {
            contains = true;
          }
        }
        if(!contains) {
          recNews[site].push(object[site][i]);
          co++;
        }
      }
    }
    for(let cat in recNews) {
      if (recNews[cat].length === 0)
        delete recNews[cat];
    }

    // console.dir(recNews);
    fs.writeFileSync("recent-news.json", JSON.stringify(recNews), { encoding : 'utf8', flag : 'w' });
    //сохраняем новости
    //склеиваем два объекта
    for (let cat in recNews){
      oldNews[cat] = oldNews[cat].concat(recNews[cat]);
      // oldNews[cat] = recNews[cat].concat(oldNews[cat]);
    }
    allNews = oldNews;
    fs.writeFileSync("news.json", JSON.stringify(oldNews), { encoding : 'utf8', flag : 'w' });
    console.dir(recNews);
    console.log('ОБНОВЛЕНИЕ: новых новостей: ' + co);
  })
  .catch(function (e) {
    // ERROR
    console.log(e);
  })
}

function processNewFeeds_Category(source, res, isGood) {
  return Promise.map(source, function (feed) {
    return processUrl_Cat({site : feed.site, cat : feed.cat, url : feed.url, isGood})
  })
  .then(function (array) {
    let object = {};
    let c = 0;
    let co = 0;
    let listRecNews = [];

    // проверяем новая ли новость
    // для тестирования data изменим сами
    let oldNews = JSON.parse(fs.readFileSync('news.json', 'utf8'));
    let new_cats = [];
    for(let i = 0; i < array.length; i++){
      // наполняем объект для файла json
      if(object[array[i].category] === undefined){
        object[array[i].category] = array[i].news;
        new_cats.push(array[i].category);
      }
      else {
        object[array[i].category] = object[array[i].category].concat(array[i].news);
      }
      c += array[i].news.length;
    }

    //сравнить два объекта - object (полученные) и oldNews(старые) новости
    let recNews = {};
    for(let k = 0; k < new_cats.length; k++){
      let site = new_cats[k];
      recNews[site] = [];
      for(let i = 0; i < object[site].length; i++) {
        let contains = false;
        for(let j = 0; j < oldNews[site].length; j++){
          if(object[site][i].title === oldNews[site][j].title) {
            contains = true;
          }
        }
        if(!contains) {
          recNews[site].push(object[site][i]);
          co++;
        }
      }
    }

    for(let cat in recNews) {
      if (recNews[cat].length === 0)
        delete recNews[cat];
      else{
        listRecNews.push({name: cat, items: shuffle(recNews[cat])});
      }
    }

    //recNews - обьект новых новостей (как news.json)
    //listRecNews - список новых новостей
    res.setHeader('Access-Control-Allow-Origin', '*');
	  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed
    res.send(JSON.stringify(listRecNews));

    fs.writeFileSync("recent-news.json", JSON.stringify(recNews), { encoding : 'utf8', flag : 'w' });
    //сохраняем новости
    //склеиваем два объекта
    for (let cat in recNews){
      oldNews[cat] = oldNews[cat].concat(recNews[cat]);
    }

    fs.writeFileSync("news.json", JSON.stringify(oldNews), { encoding : 'utf8', flag : 'w' });
    console.log('Новых новостей: ' + co);
  })
  .catch(function (e) {
    // ERROR
    console.log(e);
  })
}

function processNewFeeds(source, res) {
  return Promise.map(source, function (feed) {
    return processUrl({site : feed.site, cat : feed.cat, url : feed.url})
  })
  .then(function (array) {
    let object = {};
    let c = 0;
    let co = 0;
    let listRecNews = [];

    // проверяем новая ли новость
    // для тестирования data изменим сами
    let oldNews = JSON.parse(fs.readFileSync('news.json', 'utf8'));
    let new_cats = [];
    for(let i = 0; i < array.length; i++){
      // наполняем объект для файла json
      if(object[array[i].category] === undefined){
        object[array[i].category] = array[i].news;
        new_cats.push(array[i].category);
      }
      else {
        object[array[i].category] = object[array[i].category].concat(array[i].news);
      }
      c += array[i].news.length;
    }

    //сравнить два объекта - object (полученные) и oldNews(старые) новости
    let recNews = {};
    for(let k = 0; k < new_cats.length; k++){
      let site = new_cats[k];
      recNews[site] = [];
      for(let i = 0; i < object[site].length; i++) {
        let contains = false;
        for(let j = 0; j < oldNews[site].length; j++){
          if(object[site][i].title === oldNews[site][j].title) {
            contains = true;
          }
        }
        if(!contains) {
          recNews[site].push(object[site][i]);
          co++;
        }
      }
    }

    for(let cat in recNews) {
      if (recNews[cat].length === 0)
        delete recNews[cat];
      else{
        listRecNews.push({name: cat, items: recNews[cat]});
      }
    }

    //recNews - обьект новых новостей (как news.json)
    //listRecNews - список новых новостей
    res.setHeader('Access-Control-Allow-Origin', '*');
	  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,contenttype'); // If needed
    res.setHeader('Access-Control-Allow-Credentials', true); // If needed
    res.send(JSON.stringify(listRecNews));

    fs.writeFileSync("recent-news.json", JSON.stringify(recNews), { encoding : 'utf8', flag : 'w' });
    //сохраняем новости
    //склеиваем два объекта
    for (let cat in recNews){
      oldNews[cat] = oldNews[cat].concat(recNews[cat]);
    }

    fs.writeFileSync("news.json", JSON.stringify(oldNews), { encoding : 'utf8', flag : 'w' });
    console.log('Новых новостей: ' + co);
  })
  .catch(function (e) {
    // ERROR
    console.log(e);
  })
}

function processAllFeeds(source, res) {
  return Promise.map(source, function (feed) {
    return processUrl({site : feed.site, cat : feed.cat, url : feed.url})
  })
  .then(function (array) {
    let object = {};
    let objectS = [];
    let c = 0;
    for(let i = 0; i < array.length; i++){
      // наполняем объект для файла json
      if(object[array[i].category] === undefined){
        object[array[i].category] = array[i].news;
      }
      else {
        object[array[i].category] = object[array[i].category].concat(array[i].news);
      }
      c += array[i].news.length;
    }

    for(let i = 0; i < allCategories.length; i++){
      let temp = [];

      for(let j = 0; j < array.length; j++){
        if(array[j].category === allCategories[i])
          temp = temp.concat(array[j].news);
      }

        objectS.push({
        name : allCategories[i],
        items : temp
        // items : array.filter((item) => item.category === allCategories[i]).map((it) => {return it.news})
      });
      // data[site] = array.filter((item) => item.category === site);
    }

    // res.render('index', { news: object['Политика']});
    res.render('index', { news: objectS});

    fs.writeFileSync("objects.json", JSON.stringify(objectS), { encoding : 'utf8', flag : 'w' });
    fs.writeFileSync("news.json", JSON.stringify(object), { encoding : 'utf8', flag : 'w' });
    console.log('Получено ' + c + ' новостей');

    // наполняем объект всех новостей
    // for(let site in data){
    //   data[site] = array.filter((item) => item.site === site);
    // }

    // fs.writeFileSync("data.json", JSON.stringify(data), { encoding : 'utf8', flag : 'w' });
    // console.dir(data, 4);
  })
  .catch(function (e) {
    // ERROR
    console.log(e);
  })
}

function processUrl_Cat(feed) {
  if(feed.isGood === -1 ) {
    return request.getAsync(feed.url).spread(function (res, body) {
      switch (feed.site) {
        case 'Korr': {
          return {category: feed.cat, site: feed.site, news: getNews_Korr(body).filter((e) => e !== null)};
        }
        case 'Gord': {
          return {category: feed.cat, site: feed.site, news: getNews_Gord(body).filter((e) => e !== null)};
        }
        case 'Cen': {
          return {category: feed.cat, site: feed.site, news: getNews_Censor(body).filter((e) => e !== null)};
        }
        case 'RBC': {
          return {category: feed.cat, site: feed.site, news: getNews_RBC(body).filter((e) => e !== null)};
        }
      }
    });
  }
  else {
    let ig = feed.isGood === 1 ? true: false;
    return request.getAsync(feed.url).spread(function (res, body) {
      switch (feed.site) {
        case 'Korr': {
          return {category: feed.cat, site: feed.site, news: getNews_Korr(body).filter((e) => e !== null).filter((e) => e.isGood === ig)};
        }
        case 'Gord': {
          return {category: feed.cat, site: feed.site, news: getNews_Gord(body).filter((e) => e !== null).filter((e) => e.isGood === ig)};
        }
        case 'Cen': {
          return {category: feed.cat, site: feed.site, news: getNews_Censor(body).filter((e) => e !== null).filter((e) => e.isGood === ig)};
        }
        case 'RBC': {
          return {category: feed.cat, site: feed.site, news: getNews_RBC(body).filter((e) => e !== null)};
        }
      }
    });
  }
}

function processUrl(feed) {
  return request.getAsync(feed.url).spread(function (res, body) {
      switch (feed.site){
        case 'Korr':{
          return {category: feed.cat, site: feed.site, news: getNews_Korr(body).filter((e)=> e!== null)};
        }
        case 'Gord':{
          return {category: feed.cat, site: feed.site, news: getNews_Gord(body).filter((e)=> e!== null)};
        }
        case 'Cen':{
          return {category: feed.cat, site: feed.site, news: getNews_Censor(body).filter((e)=> e!== null)};
        }
        case 'RBC':{
          return {category: feed.cat, site: feed.site, news: getNews_RBC(body).filter((e)=> e!== null)};
        }
      }
  });
}

function getNews_Segod(html) {
  let doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('div.news-block-wrapper>div>a')).map((item)=>{
    return {
      title: fixString(item.children[1].children[0].innerHTML),
      link: 'https://www.segodnya.ua' + item.getAttribute('href')
    }
  });
}

function getNews_RBC(html) {
  let doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('div.news-feed-item div.content-section')).map((item)=>{
    let a = item.children[0];
    let spans = a.getElementsByTagName('span');
    let i = spans.length;
    while (i--) {
      spans[i].parentNode.removeChild(spans[i]);
    }
    return {
      title: fixString(a.innerHTML),
      link: a.getAttribute('href'),
      // image: 'images/news.jpg',
      image: myImages[Math.floor(Math.random() * myImages.length)],
      desc : fixString(a.innerHTML),
      isGood: analTitle(fixString(a.innerHTML)),
      icon : 'https://www.rbc.ua/static/daily/img/favicon/favicon.ico'
    };
  });
}

function getNews_Censor(html) {
  let doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('section.news div.panes div.curpane article.item')).map((item)=>{
    let img = null;
    if(item.children[0].children[0].children[0] !== undefined && item.children[0].children[2].children[0] !== undefined){
      img = item.children[0].children[0].children[0].children[0].getAttribute('src');
      let t = item.children[0].children[2].children[0].textContent;
      let l = item.children[0].children[2].children[0].getAttribute('href');
      let d = item.children[1].textContent;
      if (l !== null && t !== null && img !== null && d !== null) {
        return {
          title: t,
          link: 'https://ua.censor.net.ua' + l,
          image: img,
          desc : d,
          isGood: analTitle(t),
          icon : 'https://ua.censor.net.ua/favicon.ico'
        }
      }
      return null;
    }
    return null;
  });
}

function getNews_Gord(html) {
  let doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('div.media div.row')).map((item)=>{
    let img = null;
    if(item.children[0].children[0].children[0].children[0] !== undefined){
      img = item.children[0].children[0].children[0].children[0].getAttribute('data-src');
      // console.log(item.querySelector('div.lenta_head').innerHTML);
      let a = item.querySelector('div.lenta_head').children[0];

      let desc = item.querySelector('div.a_description').children[0].textContent;
      if (desc.indexOf('|к') > -1)
        desc = desc.substr(0, desc.indexOf('|к'));

      if (desc!== null && desc.length > 0) {
        let tit = a.textContent.replace(/\s{2,}/g, ' ').trim();
        return {
          title: tit,
          link: 'http://gordonua.com' + a.getAttribute('href'),
          image: 'http://gordonua.com' + img,
          desc: desc.replace(/\s{2,}/g, ' ').trim(),
          isGood: analTitle(tit),
          icon : 'http://gordonua.com/favicon.ico'
        }
      }
      return null;
    }
    return null;

  });
}

function getNews_Korr(html) {
  let doc = new JSDOM(html).window.document;
  return Array.from(doc.querySelectorAll('div.article_rubric_top')).map((item)=>{
    let img = item.children[0].children[0].innerHTML;
    img = img.substr(img.indexOf('=')+2).replace('">','');

    if (img.indexOf('http://') < 0) {
      img = 'images/news.jpg';
    }
    if (item.children[2]!== undefined) {
      let desc = item.children[2].innerHTML;
      desc = desc.substr(0, desc.indexOf('<d'));
      let tit = fixString(item.children[1].children[0].textContent);
      return {
        title: tit,
        link: item.children[1].children[0].getAttribute('href'),
        image: img,
        desc: fixString(desc),
        isGood: analTitle(tit),
        icon: 'http://ua.korrespondent.net/favicon.ico'
      };
    }
    return null;
  });
}

// function getNews_Korr(html) {
//   let doc = new JSDOM(html).window.document;
//   return Array.from(doc.querySelectorAll('div.article_rubric_top')).map((item)=>{
//     let img = item.children[0].children[0].innerHTML;
//     img = img.substr(img.indexOf('=')+2).replace('">','');
//
//     if (img.indexOf('http://') > -1) {
//       let desc = item.children[2].innerHTML;
//       desc = desc.substr(0, desc.indexOf('<d'));
//       let tit = fixString(item.children[1].children[0].textContent);
//       return {
//         title: tit,
//         link: item.children[1].children[0].getAttribute('href'),
//         image: 'images/news.jpg',
//         // image: img,
//         desc : fixString(desc),
//         isGood: analTitle(tit),
//         icon : 'http://ua.korrespondent.net/favicon.ico'
//       }
//     }
//     return null;
//   });
// }

function analTitle(str) {
  str = str.toLowerCase();
  for(let i = 0; i < badWords.length; i++){
    if(str.includes(badWords[i])){
      return false;
    }
  }
  return true;
}


function fixString(str) {
  return str.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim()
}

module.exports = router;
