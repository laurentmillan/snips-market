const http          = require('http');
const express       = require('express');
const bodyParser    = require('body-parser');
//const jwt           = require('jsonwebtoken');
const app           = express();

const config = require('./config.js');

const fs            = require('fs');
//var Redis = require('ioredis');
//var redis = new Redis(6379, '127.0.0.1');

Array.prototype.flatten = function() {
  return this.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? toFlatten.flatten() : toFlatten);
  }, []);
}

app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({limit: '50mb'}));

// Start the server
const server = http.createServer(app).listen(config.serverPort, function () {
});

const saveData = function(){
  fs.writeFile("data/db.json", JSON.stringify(data, null, 2), function(err) {
      if(err)
        return console.log(err);
      console.log("Data saved");
  });
}

const loadData = function(){
  fs.readFile("data/db.json", "utf8", (err, readData) => {
    if(err)
      return console.log(err);
    else
      data = JSON.parse(readData);
    console.log("Data loaded");
  });
}

let data = {
  authTokens: [],
  lists: [],
  places: [],
  products: []
}

let sampleDataLists = [{
    id: 0,
    name: "Carrefour",
    place: "Carrefour Market Chatillon",
    items: [
      {
        id: 0,
        product: {
          id: 0,
          caption: "Carottes",
          shelf: "Fruits-Légumes"
        },
        quantity: 1
      }
    ]
  },
  {
    id: 1,
    name: "Picard",
    place: "Picard Chatillon",
    items: []
  }]

let sampleProducts = [
  {
    id: 0,
    caption: "Carottes",
    names: ["carotte", "carottes"],
    shelf: "Fruits-Légumes"
  },
  {
    id: 1,
    caption: "PQ",
    names: ["PQ", "papier toilette", "papier wc"],
    shelf: "Hygiène"
  }]

const authChecker = function(req, res, next){
  console.log(req.method + " " + req.originalUrl + " " + req.get('Authorization'));
  if (req.path != "/login") {
    let AuthToken = req.get('Authorization');
    if(data.authTokens.find(validTokens => validTokens == AuthToken)){
      next();
    }else{
      if(req.method == "OPTIONS")
        next();
      else
        res.status(401).end();
    }
  } else{
    next();
  }
}

app.use(function(req, res, next){
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
  next();
});
app.use(authChecker);

const ERR = {
  LIST_NOT_FOUND: "LIST_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  PLACE_NOT_FOUND: "PLACE_NOT_FOUND",
  PRODUCT_USED_IN_LIST: "PRODUCT_USED_IN_LIST",
  PLACE_USED_IN_LIST: "PLACE_USED_IN_LIST"
}

/***************
* LISTS
**************/

const getLists = function(){
  return new Promise((resolve, reject) => {
    resolve(data.lists);
  });
}

const searchListByName = function(listName){
  return new Promise((resolve, reject) => {
    getLists().then(lists => {
      let listFound = lists.find(list => list.name.toLowerCase() == listName);
      if(listFound) resolve(listFound);
      else reject(ERR.LIST_NOT_FOUND)
    })
  });
}

const getListById = function(listId){
  return new Promise((resolve, reject) => {
    getLists().then(lists => {
      resolve(lists.find(list => list.id == listId));
    }).catch(err => {
      reject(ERR.LIST_NOT_FOUND);
    })
  });
}

const addList = function(list){
  return new Promise((resolve, reject) => {
    let listToAdd = {
      id: Math.round(Math.random()*1000000000),
      name: list.name,
      place: list.place,
      items: []
    }
    data.lists.push(listToAdd);
    saveData();
    resolve(listToAdd);
  })
}

const clearList = function(listId){
  return new Promise((resolve, reject) => {
    getListById(listId)
    .then(list => {
      list.items = [];
      resolve(list);
    })
    .catch(err => {
      reject(err);
    })
  })
}


app.get('/lists', function (req, res) {
  if(req.query.name){
    searchListByName(req.query.name)
    .then(list => {
      res.send(list);
    })
    .catch(err => {
      res.status(404).send(err);
    })
  }else{
    getLists().then(lists => { res.send(lists) });
  }
});

app.get('/lists/:id', function (req, res) {
  getListById(req.params.id).then( list => {
    res.send(list);
  }).catch(err => {
    res.status(404).send(err);
  })
});

app.delete('/lists/:id/items', function (req, res) {
  clearList(req.params.id).then( list => {
    res.send(list);
  }).catch(err => {
    res.status(404).send(err);
  })
});

app.post('/lists', function(req, res){
  addList(req.body).then(list => {
    res.send(list);
  }).catch( err => {
    res.status(404).send(err);
  })
})

const updateList = function(listId, listPatch){
  return new Promise((resolve, reject) => {
    // Can't update id
    delete listPatch.id;

    getListById(listId)
    .then(list => {
      let updatedList = JSON.parse(JSON.stringify(list));
      Object.keys(listPatch).forEach(k => updatedList[k] = listPatch[k]);

      data.lists.splice(data.lists.indexOf(list), 1, updatedList);
      saveData();
      resolve(updatedList);
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.patch('/lists/:id', function (req, res) {
  updateList(req.params.id, req.body)
  .then(updatedList => {
    res.send(updatedList);
  })
  .catch(err => { res.status(404).send(err);})
});



/***************
* PRODUCTS
**************/

const getProducts = function(){
  return new Promise((resolve, reject) => {
    resolve(data.products);
  });
}

const searchProductByName = function(name){
  return new Promise((resolve, reject) => {
    getProducts().then(products => {
      let productMap = products.map(
        product => product.names.map(
          name => {return {name: name.toLowerCase(), shelf: product.shelf, id: product.id}}
        )
      )
      .flatten();
      let productFound = productMap.find(product => product.name == name.toLowerCase())
      if(productFound) resolve(productFound)
      else reject(ERR.PRODUCT_NOT_FOUND);
    })
  })
}

const getProductById = function(productId){
  return new Promise((resolve, reject) => {
    return getProducts().then(products => {
      resolve(products.find(product => product.id == productId));
    })
  });
}

const addProduct = function(product){
  return new Promise((resolve, reject) => {
    let newProduct = {
      caption: product.caption,
      names: product.names?product.names:[product.caption],
      shelf: product.shelf?product.shelf:""
    };
    data.products.push(newProduct);
    newProduct.id = Math.round(Math.random()*1000000);
    saveData();
    resolve(newProduct);
  })
}

app.get('/products', function (req, res) {
  if(req.query.name){
    searchProductByName(req.query.name)
    .then(product => {
        if(product){
          res.send(product);
          return;
        }else{
          res.status(404).end();
          return;
        }
    })
  }else{
    getProducts().then(products => { res.send(products) });
  }
});

app.get('/products/:id', function (req, res) {
  getProductById(req.params.id).then( product => {
    if(product){
      res.send(product);
      return;
    }else{
      res.status(404).end();
      return;
    }
  })
});

app.post('/products', function(req, res){
  addProduct(req.body).then(product => {
    res.send(product);
  }).catch( err => {
    res.status(404).send(err);
  })
})

const updateProduct = function(productId, productPatch){
  return new Promise((resolve, reject) => {
    // Can't update id
    delete productPatch.id;

    getProductById(productId)
    .then(product => {
      let updatedProduct = JSON.parse(JSON.stringify(product));
      Object.keys(productPatch).forEach(k => updatedProduct[k] = productPatch[k]);

      // Check if product is used in a list
      data.lists.forEach(list => {
        list.items.forEach(item => {
          if(item.product.id == productId){
            item.product = updatedProduct;
          }
        })
      })

      data.products.splice(data.products.indexOf(product), 1, updatedProduct);
      saveData();
      resolve(updatedProduct);
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.patch('/products/:id', function (req, res) {
  updateProduct(req.params.id, req.body)
  .then(updatedProduct => {
    res.send(updatedProduct);
  })
  .catch(err => { res.status(404).send(err);})
});

const deleteProduct = function(productId){
  return new Promise((resolve, reject) => {
    getProductById(productId)
    .then(product => {

      let productIsUsed = false;
      // Check if product is used in a list
      data.lists.forEach(list => {
        list.items.forEach(item => {
          if(item.product.id == productId){
            productIsUsed = true;
          }
        })
      })

      if(productIsUsed)
        reject(ERR.PRODUCT_USED_IN_LIST);
      else{
        data.products.splice(data.products.indexOf(product), 1);
        saveData();
        resolve(product);
      }
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.delete('/products/:id', function(req, res){
  deleteProduct(req.params.id)
  .then(productDeleted => {
    res.status(200).end();
  }).catch(err => {
    res.status(403).end();
  })
})



/***************
* ITEMS
**************/

const getItemById = function(listId, itemId){
  return new Promise((resolve, reject) => {
    let list = getListById(listId).then( list => {
      if(list){
        let item = list.items.find(it => it.id == itemId);
        if(item)
          resolve(item);
        else
          reject(ERR.ITEM_NOT_FOUND);
      }
      else
        reject(ERR.LIST_NOT_FOUND);
    })
  })
}

const getListItems = function(listId){
  return new Promise((resolve, reject) => {
    getListById(listId).then(list => {
      if(list)
        resolve(list.items);
      else
        reject(ERR.LIST_NOT_FOUND);
    })
  });
}

const getListItemByProductName = function(listId, productName){
  return new Promise((resolve, reject) => {
    searchProductByName(productName)
    .then( product => {
      if(!product){
        reject(ERR.PRODUCT_NOT_FOUND);
      }else{
        getListItems(listId)
        .then( listItems => {
          if(listItems){
            let itemFound = listItems.find(item => item.product.id == product.id);
            if(itemFound)
              resolve(itemFound)
            else
              reject({err:ERR.ITEM_NOT_FOUND, product:product});
          }else{
            reject({err: ERR.LIST_NOT_FOUND, product: product});
          }
        })
        .catch(err => {
          reject({err: err, product: product});
        })
      }
    })
    .catch(err => {
      // Product not found
      reject(ERR.PRODUCT_NOT_FOUND);
    })
  })
}

const addItemInList = function(listId, newItem){
  return new Promise((resolve, reject) => {
    getListById(listId)
    .then(list => {
      newItem.id = Math.round(Math.random()*1000000000);
      list.items.push(newItem);
      saveData();
      resolve(newItem);
    })
    .catch(err => {
      reject(err);
    })
  })
}

const updateItem = function(listId, itemId, itemPatch){
  return new Promise((resolve, reject) => {
    getItemById(listId, itemId)
    .then(item => {
      let updatedItem = JSON.parse(JSON.stringify(item));
      Object.keys(itemPatch).forEach(k => updatedItem[k] = itemPatch[k]);

      let list = data.lists.find(list => list.id == listId);
      list.items.splice(list.items.indexOf(item), 1, updatedItem);
      saveData();
      resolve(updatedItem);
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.get('/lists/:listId/items', function (req, res) {
  if(req.query.product){
    getListItemByProductName(req.params.listId, req.query.product)
    .then( item => {
      res.send(item);
    })
    .catch( err => {
      switch(err){
        case ERR.LIST_NOT_FOUND: res.status(404).end("List not found"); break;
        case ERR.ITEM_NOT_FOUND: res.status(404).end("Item not found"); break;
        case ERR.PRODUCT_NOT_FOUND: res.status(404).end("Product not found"); break;
      }
    })
  }else{
    getListItems(listId)
    .then( listItems => {
      res.send(listItems);
    })
    .catch( err => {
      console.log("err", err);
      switch(err){
        case ERR.LIST_NOT_FOUND: res.status(404).end("List not found"); break;
      }
    })
  }
});

app.get('/lists/:listId/items/:itemId', function (req, res) {
  getItemById(req.params.listId, req.params.itemId)
  .then(item => {
    res.send(item)
  })
  .catch(err => {
    switch(err){
      case ERR.LIST_NOT_FOUND: res.status(404).end("List not found"); break;
      case ERR.ITEM_NOT_FOUND: res.status(404).end("Item not found"); break;
    }
  })
});

const addItem = function(listId, newItem){
  return new Promise((resolve, reject) => {
    getListItemByProductName( listId, newItem.product.caption)
    .then( item => {
      if(newItem.quantity){
        item.quantity += newItem.quantity;
      }else{
        item.quantity++;
      }
      updateItem(listId, item.id, item)
      .then(itemUpdated => {
        saveData();
        resolve(itemUpdated);
      })
      .catch(err => {
        reject(err);
      })
    })
    .catch( errData => {
      let err = (typeof errData == "string")?errData:errData.err;
      let productFound = (typeof errData == "string")?null:errData.product;

      switch(err){
        case ERR.PRODUCT_NOT_FOUND:
          addProduct({
            caption: newItem.product.caption,
            names: [newItem.product.caption],
            shelf: ""
          })
          .then(productAdded => {
            addItemInList(listId, {
              product: {
                id: productAdded.id,
                caption: productAdded.caption,
                shelf: productAdded.shelf
              },
              quantity: newItem.quantity?newItem.quantity:1
            })
            .then(newItem => {
              resolve(newItem);
            })
          })
          break;
        case ERR.ITEM_NOT_FOUND:
          addItemInList(listId, {
            product: {
              id: productFound.id,
              caption: productFound.name,
              shelf: productFound.shelf
            },
            quantity: newItem.quantity?newItem.quantity:1
          })
          .then(newItem => {
            resolve(newItem);
          })
          .catch(err => {
            reject(err);
          })
          break;
        default:
          console.log(err);
          break;
      }
    })
  });
}

app.post('/lists/:listId/items', function (req, res) {
  let sample = {
    product: {
      caption: "",
    },
    quantity: 1
  }

  let newItem = req.body;
  addItem( req.params.listId, newItem)
  .then( itemAdded => {
    res.send(itemAdded)
  })
  .catch( err => {
    res.status(404).send(err);
  })
});

app.patch('/lists/:listId/items/:itemId', function (req, res) {
  updateItem(req.params.listId, req.params.itemId, req.body)
  .then(updatedItem => {
    res.send(updatedItem);
  })
  .catch(err => { res.status(404).send(err);})
});

const deleteItem = function(listId, itemId){
  return new Promise((resolve, reject) => {
    getListById(listId).then(list => {
      getItemById(listId, itemId)
      .then(item => {
        list.items.splice(list.items.indexOf(item), 1);
        saveData();
        resolve(list);
      })
    })
    .catch(err => {
      console.log(err);
      reject(err);
    })
  })
}

app.delete('/lists/:listId/items/:itemId', function (req, res) {
  deleteItem(req.params.listId, req.params.itemId)
  .then(() => {
    res.status(200).end();
  })
  .catch(err => { res.status(404).send(err);})
});

const getPrintableList = function(listId){
  return new Promise((resolve, reject) => {
    getListById(listId)
    .then(list => {
      var sortItemByShelf = function(a, b){
      	return list.place.shelves.indexOf(a.product.shelf) - list.place.shelves.indexOf(b.product.shelf)
      }
      list.items = list.items.sort(sortItemByShelf)
      resolve(list);
    }).catch(err => { reject(err) })
  })
}

app.get('/lists/:listId/printable', function(req, res){
  getPrintableList(req.params.listId).then(list => {
    res.send(list);
  }).catch(err => {  res.status(404).send(err); })
})


/***************
* PLACES
**************/

const getPlaces = function(){
  return new Promise((resolve, reject) => {
    resolve(data.places);
  });
}

const getPlaceById = function(placeId){
  return new Promise((resolve, reject) => {
    getPlaces().then(places => {
      resolve(places.find(place => place.id == placeId));
    }).catch(err => {
      reject(ERR.PLACE_NOT_FOUND);
    })
  });
}

app.get('/places', function (req, res) {
  getPlaces().then(places => {
    res.send(places);
  }).catch(err => {
    res.status(500).end();
  })
});

app.get('/places/:id', function (req, res) {
  getPlaceById(req.params.id).then(place => {
    res.send(place);
  }).catch(err => {
    res.status(404).send(err);
  })
});

const updatePlace = function(placeId, placePatch){
  return new Promise((resolve, reject) => {
    // Can't update id
    delete placePatch.id;

    getPlaceById(placeId)
    .then(place => {
      let updatedPlace = JSON.parse(JSON.stringify(place));
      Object.keys(placePatch).forEach(k => updatedPlace[k] = placePatch[k]);

      // Check if place is used in a list
      data.lists.forEach(list => {
        if(list.place.id == placeId){
          list.place = updatedPlace;
        }
      })

      data.places.splice(data.places.indexOf(place), 1, updatedPlace);
      saveData();
      resolve(updatedPlace);
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.patch('/places/:id', function (req, res) {
  updatePlace(req.params.id, req.body)
  .then(updatedPlace => {
    res.send(updatedPlace);
  })
  .catch(err => { res.status(404).send(err);})
});

const deletePlace = function(placeId){
  return new Promise((resolve, reject) => {
    getPlaceById(placeId)
    .then(place => {

      let placeIsUsed = false;
      // Check if place is used in a list
      data.lists.forEach(list => {
        if(list.place.id == placeId){
          placeIsUsed = true;
        }
      })

      if(placeIsUsed)
        reject(ERR.PLACE_USED_IN_LIST);
      else{
        data.places.splice(data.places.indexOf(place), 1);
        saveData();
        resolve(place);
      }
    })
    .catch(err => {
      reject(err);
    })
  })
}

app.delete('/places/:id', function(req, res){
  deletePlace(req.params.id)
  .then(placeDeleted => {
    res.status(200).end();
  }).catch(err => {
    res.status(403).end();
  })
})

const addPlace = function(place){
  return new Promise((resolve, reject) => {
    let newPlace = {
      name: place.name,
      shelves: []
    };
    data.places.push(newPlace);
    newPlace.id = Math.round(Math.random()*1000000);
    saveData();
    resolve(newPlace);
  })
}

app.post('/places', function(req, res){
  addPlace(req.body).then(place => {
    res.send(place);
  }).catch( err => {
    res.status(404).send(err);
  })
})



app.post('/intent', function(req, res) {
  let snipsRes = req.body;
  // identifier le slot listname
  let listnameSlot = snipsRes.slots.find(slot => slot.slotName == "listname");
  // Recherche du slot du nom du produit
  let productSlot = snipsRes.slots.find(slot => slot.slotName == "product");
  // Recherche du slot du nom du produit
  let quantitySlot = snipsRes.slots.find(slot => slot.slotName == "quantity");

  switch (snipsRes.intent.intentName) {
    case "shivan:AddItem":
      searchListByName(listnameSlot.rawValue)
      .then(list => {
        addItem(list.id, {
          product: {
            caption: productSlot.rawValue
          },
          quantity: (quantitySlot && quantitySlot.value && quantitySlot.rawValue)?quantitySlot.rawValue:1
        })
        .then( item => {
          res.send(item)
        })
        .catch(err => {
          res.status(404).send(err);
        })
      })
      .catch(err => {
        res.status(404).send("List not found");
      })
      break;
    case "shivan:ListItems":
      searchListByName(listnameSlot.rawValue)
      .then(list => {
        res.send(list.items);
      })
      .catch(err => {
        res.status(404).send(err);
      })
    case "shivan:SearchItem":
      searchListByName(listnameSlot.rawValue)
      .then(list => {
        getListItemByProductName(list.id, productSlot.rawValue)
        .then(item => {
          res.send(item);
        })
        .catch(err => {
          res.status(404).send(err);
        })
      })
      .catch(err => {
        res.status(404).send(err);
      })
    case "shivan:NumberItems":
      searchListByName(listnameSlot.rawValue)
      .then(list => {
        getListItemByProductName(list.id, productSlot.rawValue)
        .then(item => {
          res.send(item.quantity);
        })
        .catch(err => {
          res.status(404).send(err);
        })
      })
      .catch(err => {
        res.status(404).send(err);
      })
    default:
      break;
  }
})

loadData();
