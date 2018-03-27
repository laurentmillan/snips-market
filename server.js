const http          = require('http');
const express       = require('express');
const bodyParser    = require('body-parser');
//const jwt           = require('jsonwebtoken');
const app           = express();

const config = require('./config.js');

var Redis = require('ioredis');
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

let sampleDataAuthTokens = ["1234"]

let sampleDataLists = [
  {
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
  }
]

let sampleDataPlaces = [
  {
    id: 0,
    name: "Carrefour Market Chatillon",
    shelves: [
      "Fruits-Légumes",
      "Viande"
    ]
  }
]

let sampleDataProducts = [
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
  }
]

const authChecker = function(req, res, next){
  console.log(req.method + " " + req.originalUrl);
  if (req.path != "/login") {
    let AuthToken = req.get('Authorization');
    if(sampleDataAuthTokens.find(validTokens => validTokens == AuthToken)){
      next();
    }else{
      res.status(401).end();
    }
  } else{
    next();
  }
}

app.use(authChecker);


/***************
* LISTS
**************/
const getLists = function(){
  return new Promise((resolve, reject) => {
    resolve(sampleDataLists);
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
      let list = lists.find(list => list.id == listId);
      if(list) resolve(list);
      else reject(ERR.LIST_NOT_FOUND);
    })
  });
}

app.get('/lists', function (req, res) {
  if(req.query.name){
    searchListByName(req.query.name)
    .then(list => {
        if(list){
          res.send(list);
          return;
        }else{
          res.status(404).end();
          return;
        }
    })
  }else{
    getLists().then(lists => { res.send(lists) });
  }
});

app.get('/lists/:id', function (req, res) {
  getListById(req.params.id).then( list => {
    if(list){
      res.send(list);
      return;
    }else{
      res.status(404).end();
      return;
    }
  })
});



/***************
* PRODUCTS
**************/

const getProducts = function(){
  return new Promise((resolve, reject) => {
    resolve(sampleDataProducts);
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



/***************
* ITEMS
**************/
const ERR = {
  LIST_NOT_FOUND: "LIST_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
}

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
      newItem.id = Math.round(Math.random()*1000000);
      list.items.push(newItem);
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

      let list = sampleDataLists.find(list => list.id == listId);
      list.items.splice(list.items.indexOf(item), 1, updatedItem);
      resolve(updatedItem);
    })
    .catch(err => {
      reject(err);
    })
  })
}

const addProduct = function(product){
  return new Promise((resolve, reject) => {
    let newProduct = {
      caption: product.caption,
      names: product.names?product.names:[product.caption],
      shelf: product.shelf?product.shelf:""
    };
    sampleDataProducts.push(newProduct);
    // TODO: Get le newProduct avec son id
    newProduct.id = Math.round(Math.random()*1000000);
    resolve(newProduct);
  })
}

const addProductInList = function(listId, product, quantity){
  // Recherche si le produit existe dans la liste
  let productItem = getProductInList(listId, product.caption);
  if(productItem){
    // Le produit est déjà dans la liste
    let quantity = productItem.quantity + (quantity?quantiy:1);
    productItem.quantity = quantity;
    //TODO save item in list
  }else{
    // Le produit n'est pas déjà dans la liste
    // Vérifier s'il est dans la liste des produits
    let productToAdd = searchProduct(product.caption);
    if(!productToAdd){
      // Si non, l'ajouter
      productToAdd = addProduct(product);
    }

    let list = getListById(listId);
    let newItem = {
      product: {
        id: productToAdd.id,
        caption: productToAdd.caption,
        shelf: productToAdd.shelf
      },
      quantity: (quantiy)?quantity:1
    }
    list.items.push(newItem)
    return newItem;
  }
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
  let list = getListById(req.params.listId);
  if(!list){
    res.status(404).end("List not found");
    return;
  }
  let item = getItemById(list.id, req.params.itemId);
  if(!item){
    res.status(404).end("Item not found in list");
    return;
  }else{
    if(req.body.quantity){
      listItemArrayIndex = list.items.indexOf(item);
      list.items[listItemArrayIndex].quantity = req.body.quantity;
      res.send(list.items[listItemArrayIndex]);
    }
  }
});

app.get('/places', function (req, res) {
  res.send(sampleDataPlaces);
});

app.get('/places/:id', function (req, res) {
  res.send(sampleDataPlaces.find(place => place.id == req.params.id));
});

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
