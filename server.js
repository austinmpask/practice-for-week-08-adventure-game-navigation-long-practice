const http = require("http");
const fs = require("fs");

const { Player } = require("./game/class/player");
const { World } = require("./game/class/world");

const worldData = require("./game/data/basic-world-data");
let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {
  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = "";
  req.on("data", (data) => {
    reqBody += data;
  });

  req.on("end", () => {
    // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === "GET" && req.url === "/") {
      const page = fs.readFileSync("./views/new-player.html", "utf-8");

      let options = "";
      for (let room in world.rooms) {
        options += `<option>${world.rooms[room].name}</option>
        `;
      }
      const templatePage = page.replace(/#{availableRooms}/g, options);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(templatePage);
    }

    // Phase 2: POST /player
    if (req.method === "POST" && req.url === "/player") {
      let name = req.body.name;
      let startingRoom = req.body.roomId;
      let roomId = Object.values(world.rooms).find(
        (room) => room.name === startingRoom
      ).id;
      player = new Player(name, world.rooms[roomId]);

      const page = fs.readFileSync("./views/room.html", "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Location", `/rooms/${roomId}`);
      res.statusCode = 302;
      return res.end();
    }

    if (req.method === "GET" && req.url.startsWith("/item")) {
      const urlSplit = req.url.split("/");
      if (urlSplit.length === 4) {
        if (urlSplit[3] === "take") {
          if (urlSplit[2] < player.currentRoom.items.length) {
            player.items.push(player.currentRoom.items[urlSplit[2]]);
            player.currentRoom.items.splice(urlSplit[2], 1);
            //remove from room
          }
        } else if (urlSplit[3] === "drop") {
          const item = player.items[urlSplit[2]];
          player.currentRoom.items.push(item);
          player.items.splice(urlSplit[2], 1);
        }
        res.setHeader("Content-Type", "text/html");
        res.setHeader("Location", `/rooms/${player.currentRoom.id}`);
        res.statusCode = 302;
        return res.end();
      }
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === "GET" && req.url.startsWith("/rooms/")) {
      const urlSplit = req.url.split("/");
      console.log(urlSplit);
      if (urlSplit.length === 3) {
        //redirect if not players current room
        if (world.rooms[urlSplit[2]].name !== player.currentRoom.name) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Location", `/rooms/${player.currentRoom.id}`);
          res.statusCode = 302;
          return res.end();
        } else {
          const page = fs.readFileSync("./views/room.html", "utf-8");

          //parse lists to html stuff
          let listInv = parse(player.items);
          let roomInv = parseItem(player.currentRoom.items, req.url);
          let exits = parseExit(
            Object.keys(player.currentRoom.exits),
            Object.values(player.currentRoom.exits),
            req.url
          );

          //replace in the template
          const templatePage = page
            .replace(/#{roomName}/g, world.rooms[urlSplit[2]].name)
            .replace(/#{inventory}/g, listInv)
            .replace(/#{roomItems}/g, roomInv)
            .replace(/#{exits}/g, exits);

          //serve it up
          res.setHeader("Content-Type", "text/html");
          res.statusCode = 200;
          return res.end(templatePage);
        }
      } else if (urlSplit.length === 4) {
        const direction = urlSplit[3];
        console.log(direction);

        //yes this is spaghetti i know
        if (world.rooms[urlSplit[2]].name !== player.currentRoom.name) {
          res.setHeader("Content-Type", "text/html");
          res.setHeader("Location", `/rooms/${player.currentRoom.id}`);
          res.statusCode = 302;
          return res.end();
        } else {
          if (Object.keys(player.currentRoom.exits).includes(direction)) {
            const newRoom = player.currentRoom.exits[direction];
            console.log(newRoom);
            player.currentRoom = newRoom;
            res.setHeader("Location", `/rooms/${newRoom.id}`);
            res.setHeader("Content-Type", "text/html");
            res.statusCode = 302;
            return res.end();
          } else {
            res.setHeader("Content-Type", "text/html");
            res.setHeader("Location", `/rooms/${player.currentRoom.id}`);
            res.statusCode = 302;
            return res.end();
          }
        }
      }
    }

    // Phase 4: GET /rooms/:roomId/:direction

    // Phase 5: POST /items/:itemId/:action

    // Phase 6: Redirect if no matching route handlers
  });
});

function parse(list) {
  let exp = `<ul>`;
  for (let i = 0; i < list.length; i++) {
    exp += `<li><a href="http://localhost:${port}/items/${i}/drop">${list[i].name}</a></li>`;
  }
  exp += `</ul>`;
  return exp;
}

function parseItem(list, url) {
  let exp = `<ul>`;
  for (let i = 0; i < list.length; i++) {
    exp += `<li><a href="http://localhost:${port}/items/${i}/take">${list[i].name}: ${list[i].description}</a></li>`;
  }
  exp += `</ul>`;
  return exp;
}

function parseExit(keys, values, url) {
  let exp = `<ul>`;
  for (let i = 0; i < keys.length; i++) {
    exp += `<li><a href="http://localhost:${port}${url}/${keys[i]}">${values[i].name}</a></li>`;
  }
  exp += `</ul>`;
  return exp;
}

const port = 5000;

server.listen(port, () => console.log("Server is listening on port", port));
