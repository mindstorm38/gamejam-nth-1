const Game = (function(){

    const STATE = {
        MAIN_MENU: "main_menu",
        EDITING: "editing",
        PLAYING: 'playing'
    };

    const DEBUG = true;

    // Current global state
    let state = null;

    // Main menu elements
    let mainMenuElt;
    let actionEditElt;
    let actionPlayElt;

    // Edit menu elements
    let editHelpElt;
    let editTurnWidthElt;
    let editTurnCorner1Elt;
    let editTurnCorner2Elt;
    let editTurnWidthInput;
    let editTurnCorner1Input;
    let editTurnCorner2Input;

    // Playing menu elements
    let playingStopElt;
    let actionStopPlayingElt;

    // Map rendering
    let mapCanvas;
    let mapCtx;

    // Race rendering
    let raceCanvas;
    let raceCtx;

    // Mouse
    let mousePos;

    // Keyboard
    let keys = {};

    // Map object
    let map;
    let race = null;

    // Editing data
    let hoverTurnIdx = null;
    let editingTurnIdx = null;
    let movingTurnIdx = null;
    let movingTurnMoved;
    let movingTurnLastPoint;

    // Playing data
    let playingLoopHandle = null;

    // Global event to load game when page fully loaded
    document.addEventListener("DOMContentLoaded", init);

    function init() {

        mainMenuElt = document.getElementById("main-menu");
        actionEditElt = document.getElementById("act-edit");
        actionPlayElt = document.getElementById("act-play");

        editHelpElt = document.getElementById("edit-help");
        editTurnWidthElt = document.getElementById("edit-turn-width");
        editTurnCorner1Elt = document.getElementById("edit-turn-corner1");
        editTurnCorner2Elt = document.getElementById("edit-turn-corner2");
        editTurnWidthInput = editTurnWidthElt.querySelector("input");
        editTurnCorner1Input = editTurnCorner1Elt.querySelector("input");
        editTurnCorner2Input = editTurnCorner2Elt.querySelector("input");

        playingStopElt = document.getElementById("playing-stop");
        actionStopPlayingElt = document.getElementById("act-stop-playing");

        mapCanvas = document.getElementById("map");
        mapCtx = mapCanvas.getContext("2d");

        raceCanvas = document.getElementById("race");
        raceCtx = raceCanvas.getContext("2d");

        mousePos = new Utils.Point();

        map = new Building.Map();
        map.addTurn(new Building.Turn(150, 200, 150, 50, 50));
        map.addTurn(new Building.Turn(300, 400, 150, 50, 50));
        map.addTurn(new Building.Turn(500, 200, 150, 50, 50));
        map.addTurn(new Building.Turn(700, 300, 150, 50, 50));
        map.addTurn(new Building.Turn(800, 100, 150, 50, 50));

        movingTurnLastPoint = new Utils.Point();

        updateSize();
        renderMap();

        window.addEventListener("resize", updateSize);
        raceCanvas.addEventListener("mousemove", mouseMove);
        raceCanvas.addEventListener("mousedown", mouseDown);
        raceCanvas.addEventListener("mouseup", mouseUp);
        window.addEventListener("keydown", keyDown);
        window.addEventListener("keyup", keyUp);

        editTurnWidthInput.addEventListener("keyup", turnWidthKeyUp);
        editTurnCorner1Input.addEventListener("keyup", turnCorner1KeyUp);
        editTurnCorner2Input.addEventListener("keyup", turnCorner2KeyUp);

        setState(STATE.MAIN_MENU);

        actionEditElt.addEventListener("click", actionEdit);
        actionPlayElt.addEventListener("click", actionPlay);
        actionStopPlayingElt.addEventListener("click", actionStopPlaying);

    }

    // Global state

    function setState(newState) {

        if (state === newState)
            return;

        state = newState;
        console.log("Switching to state '" + newState + "'.");

        mainMenuElt.classList.toggle("active", state === STATE.MAIN_MENU);
        editHelpElt.classList.toggle("active", state === STATE.EDITING);
        playingStopElt.classList.toggle("active", state === STATE.PLAYING);

        hoverTurnIdx = null;
        movingTurnIdx = null;

        if (playingLoopHandle != null)
            clearInterval(playingLoopHandle);

        if (state === STATE.PLAYING) {

            race = new Race.Race(map);
            race.newCar();

            playingLoopHandle = setInterval(() => {
                race.update();
                renderRace();
            }, 10);

        } else if (race != null) {

            race = null;
            renderRace();

        }

        setCursor("default");
        renderMap();

    }

    // Main menu

    function actionEdit() {
        if (state === STATE.MAIN_MENU) {
            setState(STATE.EDITING);
        }
    }

    function actionPlay() {
        if (state === STATE.MAIN_MENU) {
            setState(STATE.PLAYING);
        }
    }

    // Edit menu

    function turnWidthKeyUp() {
        if (state === STATE.EDITING && editingTurnIdx !== null) {
            map.changeTurn(editingTurnIdx, (turn) => {
                turn.length = parseInt(this.value);
            });
            renderMap();
        }
    }

    function turnCorner1KeyUp() {
        if (state === STATE.EDITING && editingTurnIdx !== null) {
            map.changeTurn(editingTurnIdx, (turn) => {
                turn.corner1.radius = parseInt(this.value);
            });
            renderMap();
        }
    }

    function turnCorner2KeyUp() {
        if (state === STATE.EDITING && editingTurnIdx !== null) {
            map.changeTurn(editingTurnIdx, (turn) => {
                turn.corner2.radius = parseInt(this.value);
            });
            renderMap();
        }
    }

    // Playing menu

    function actionStopPlaying() {
        setState(STATE.MAIN_MENU);
    }

    // Rendering

    function updateSize() {
        mapCanvas.width = window.innerWidth;
        mapCanvas.height = window.innerHeight;
        raceCanvas.width = window.innerWidth;
        raceCanvas.height = window.innerHeight;
        renderMap();
        renderRace();
        updateEditTurnInputs();
    }

    // Mouse

    function mouseMove(e) {

        mousePos.x = e.clientX;
        mousePos.y = e.clientY;

        if (state === STATE.EDITING) {

            // Editing

            if (movingTurnIdx !== null) {

                const mdx = mousePos.x - movingTurnLastPoint.x;
                const mdy = mousePos.y - movingTurnLastPoint.y;

                movingTurnMoved = true;

                map.changeTurn(movingTurnIdx, (turn) => {
                    turn.center.x += mdx;
                    turn.center.y += mdy;
                });

                movingTurnLastPoint.x = mousePos.x;
                movingTurnLastPoint.y = mousePos.y;

                renderMap();
                setCursor("move");

            } else {

                let newHoverTurnIdx = null;

                map.eachTurn((turn, idx) => {

                    const dist = turn.length + ((turn.corner1.radius + turn.corner2.radius) * 0.5);
                    if (turn.center.distToRaw(mousePos.x, mousePos.y) <= dist) {
                        newHoverTurnIdx = idx;
                        return false;
                    }

                });

                if (hoverTurnIdx !== newHoverTurnIdx) {

                    hoverTurnIdx = newHoverTurnIdx;
                    renderMap();
                    setCursor(hoverTurnIdx === null ? "default" : "pointer");

                }

            }

        }

    }

    function mouseDown(e) {

        if (state === STATE.EDITING) {

            if (editingTurnIdx !== null) {

                editingTurnIdx = null;
                updateEditTurnInputs();
                renderMap();

            }

            if (hoverTurnIdx !== null) {

                movingTurnIdx = hoverTurnIdx;
                movingTurnMoved = false;
                movingTurnLastPoint.x = mousePos.x;
                movingTurnLastPoint.y = mousePos.y;

            }

        }

    }

    function mouseUp(e) {

        if (state === STATE.EDITING) {

            if (movingTurnIdx !== null) {

                if (!movingTurnMoved) {
                    const turn = map.turns[movingTurnIdx];
                    if (turn != null) {

                        editingTurnIdx = movingTurnIdx;
                        editTurnWidthInput.value = turn.length;
                        editTurnCorner1Input.value = turn.corner1.radius;
                        editTurnCorner2Input.value = turn.corner2.radius;
                        updateEditTurnInputs();

                    }
                }

                movingTurnIdx = null;
                renderMap();
                setCursor("pointer");

            }

        }

    }

    // Keyboard

    function keyDown(e) {
        keys[e.code] = true;
        keyEvent();
    }

    function keyUp(e) {
        keys[e.code] = false;
        keyEvent();
    }

    function isKeyDown(keyCode) {
        return keys[keyCode] === true;
    }

    function keyEvent() {

        if (state === STATE.EDITING) {
            if (isKeyDown("Escape")) {
                setState(STATE.MAIN_MENU);
            } else if (isKeyDown("KeyU")) {
                const sector = map.getSector(mousePos);
                console.log("current sector : " + sector);
            } else if (isKeyDown("KeyT")) {
                map.addTurn(new Building.Turn(mousePos.x, mousePos.y, 100, 50, 50));
                renderMap();
            }
        }

    }

    // Miscellaneous

    function setCursor(cursor) {
        raceCanvas.style["cursor"] = cursor;
    }

    function clear(canvas, ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function updateEditTurnInputs() {

        const active = (editingTurnIdx !== null);
        editTurnWidthElt.classList.toggle("active", active);
        editTurnCorner1Elt.classList.toggle("active", active);
        editTurnCorner2Elt.classList.toggle("active", active);

        if (active) {
            const turn = map.turns[editingTurnIdx];
            if (turn != null) {

                editTurnWidthElt.style["left"] = turn.center.x + "px";
                editTurnWidthElt.style["bottom"] = (mapCanvas.height - turn.center.y + 20) + "px";

                editTurnCorner1Elt.style["top"] = turn.corner1.center.y + "px";
                editTurnCorner2Elt.style["top"] = turn.corner2.center.y + "px";

                if (turn.corner1.center.x > turn.corner2.center.x) {

                    editTurnCorner1Elt.style["left"] = (turn.corner1.center.x + 10) + "px";
                    editTurnCorner2Elt.style["right"] = (mapCanvas.width - turn.corner2.center.x + 10) + "px";
                    editTurnCorner1Elt.style["right"] = null;
                    editTurnCorner2Elt.style["left"] = null;

                } else {

                    editTurnCorner1Elt.style["right"] = (mapCanvas.width - turn.corner1.center.x + 10) + "px";
                    editTurnCorner2Elt.style["left"] = (turn.corner2.center.x + 10) + "px";
                    editTurnCorner1Elt.style["left"] = null;
                    editTurnCorner2Elt.style["right"] = null;

                }

            }
        }

    }

    function renderMap() {

        clear(mapCanvas, mapCtx);

        mapCtx.fillStyle = "black";
        mapCtx.font = "15px sans-serif";

        if (state === STATE.EDITING) {

            map.eachTurn((turn, idx) => {

                if (hoverTurnIdx === idx || editingTurnIdx === idx) {

                    mapCtx.strokeStyle = "lightgray";

                    mapCtx.beginPath();
                    mapCtx.arc(turn.corner1.center.x, turn.corner1.center.y, turn.corner1.radius, 0, Utils.TWO_PI);
                    mapCtx.stroke();

                    mapCtx.beginPath();
                    mapCtx.arc(turn.corner2.center.x, turn.corner2.center.y, turn.corner2.radius, 0, Utils.TWO_PI);
                    mapCtx.stroke();

                }

                if (DEBUG) {

                    mapCtx.strokeStyle = "orange";
                    mapCtx.beginPath();
                    mapCtx.moveTo(turn.corner1.center.x, turn.corner1.center.y);
                    mapCtx.lineTo(turn.corner2.center.x, turn.corner2.center.y);
                    mapCtx.stroke();

                    mapCtx.strokeStyle = "blue";
                    mapCtx.beginPath();
                    mapCtx.moveTo(turn.center.x, turn.center.y);
                    mapCtx.lineTo(turn.center.x + Math.cos(turn.angle) * 100, turn.center.y + Math.sin(turn.angle) * 100);
                    mapCtx.stroke();

                    mapCtx.fillText(turn.corner1.exterior ? "ext1" : "int1", turn.corner1.center.x, turn.corner1.center.y);
                    mapCtx.fillText(turn.corner2.exterior ? "ext2" : "int2", turn.corner2.center.x, turn.corner2.center.y);

                }

            });

        }

        map.eachGroup((t1, t2) => {

            if (state === STATE.EDITING && DEBUG) {

                mapCtx.strokeStyle = "red";
                mapCtx.beginPath();
                mapCtx.moveTo(t1.center.x, t1.center.y);
                mapCtx.lineTo(t2.center.x, t2.center.y);
                mapCtx.stroke();

            }

            mapCtx.strokeStyle = "black";

            mapCtx.beginPath();
            mapCtx.moveTo(t1.corner1.attachNext.x, t1.corner1.attachNext.y);
            mapCtx.lineTo(t2.corner1.attachPrev.x, t2.corner1.attachPrev.y);
            mapCtx.stroke();

            mapCtx.beginPath();
            mapCtx.moveTo(t1.corner2.attachNext.x, t1.corner2.attachNext.y);
            mapCtx.lineTo(t2.corner2.attachPrev.x, t2.corner2.attachPrev.y);
            mapCtx.stroke();

            if (t2.next != null) {

                mapCtx.beginPath();
                mapCtx.arc(t2.corner1.center.x, t2.corner1.center.y, t2.corner1.radius, t2.corner1.anglePrev, t2.corner1.angleNext, !t2.corner1.exterior);
                mapCtx.stroke();

                mapCtx.beginPath();
                mapCtx.arc(t2.corner2.center.x, t2.corner2.center.y, t2.corner2.radius, t2.corner2.anglePrev, t2.corner2.angleNext, !t2.corner2.exterior);
                mapCtx.stroke();

            } else {

                mapCtx.strokeStyle = "red";
                mapCtx.beginPath();
                mapCtx.moveTo(t2.corner1.attachPrev.x, t2.corner1.attachPrev.y);
                mapCtx.lineTo(t2.corner2.attachPrev.x, t2.corner2.attachPrev.y);
                mapCtx.stroke();

            }

            if (t1.prev == null) {

                mapCtx.strokeStyle = "green";
                mapCtx.beginPath();
                mapCtx.moveTo(t1.corner1.attachNext.x, t1.corner1.attachNext.y);
                mapCtx.lineTo(t1.corner2.attachNext.x, t1.corner2.attachNext.y);
                mapCtx.stroke();

            }

        });

    }

    function renderRace() {

        clear(raceCanvas, raceCtx);

        if (race == null)
            return;

        race.eachCar((car) => {

            raceCtx.fillStyle = "black";
            raceCtx.beginPath();
            raceCtx.moveTo(car.casePoints[0].x, car.casePoints[0].y);
            for (let i = 1; i < car.casePoints.length; ++i)
                raceCtx.lineTo(car.casePoints[i].x, car.casePoints[i].y);
            raceCtx.closePath();
            raceCtx.stroke();

            /*
            raceCtx.fillStyle = "black";
            raceCtx.beginPath();
            raceCtx.arc(car.pos.x, car.pos.y, 5, 0, Utils.TWO_PI);
            raceCtx.stroke();

            raceCtx.fillStyle = "red";
            raceCtx.beginPath();
            raceCtx.moveTo(car.pos.x, car.pos.y);
            raceCtx.lineTo(car.pos.x + Math.cos(car.angle) * 15, car.pos.y + Math.sin(car.angle) * 15);
            raceCtx.stroke();*/

        });

    }

    return {
        getDebugCtx: () => mapCtx,
        isKeyDown: isKeyDown
    };

})();

const Building = (function(){

    function Map() {
        this.turns = [];
    }

    Map.prototype.addTurn = function(turn) {

        turn.prev = (this.turns.length === 0) ? null : this.turns[this.turns.length - 1];

        turn.updateCache();

        turn.ifPrev(p => {
            p.next = turn;
            p.updateCache();
        });

        this.turns.push(turn);

        this.updateAttaches();

    }

    Map.prototype.eachTurn = function(cb) {
        for (let i = 0; i < this.turns.length; ++i) {
            if (cb(this.turns[i], i) === false) {
                break;
            }
        }
    }

    Map.prototype.eachGroup = function(cb) {
        for (let i = 0; i < this.turns.length - 1; ++i) {
            if (cb(this.turns[i], this.turns[i + 1], i) === false) {
                break;
            }
        }
    }

    Map.prototype.changeTurn = function(idx, cb) {

        if (idx >= 0 && idx < this.turns.length) {

            const turn = this.turns[idx];
            cb(turn);

            turn.updateCache();
            turn.ifPrev(p => p.updateCache());
            turn.ifNext(n => n.updateCache());
            this.updateAttaches();

        }

    }

    Map.prototype.updateAttaches = function() {

        // https://gieseanw.wordpress.com/2012/09/12/finding-external-tangent-points-for-two-circles/

        this.eachGroup((t1, t2) => {

            const prev = t1.prev;
            const next = t2.next;

            for (let i = 0; i < 2; ++i) {

                const t1Corner = t1.getCorner(i + 1);
                const t2Corner = t2.getCorner(i + 1);

                t1Corner.exterior = true;
                t2Corner.exterior = true;

                if (prev != null) {

                    const prevCorner = prev.getCorner(i + 1);
                    const a1 = prevCorner.center.angleTo(t1Corner.center);
                    const a2 = prevCorner.center.angleTo(t2Corner.center);
                    const rel = Utils.solveAngle(a2 - a1);

                    t1Corner.exterior = rel >= 0 && rel < Math.PI;

                }

                if (next != null) {

                    const nextCorner = next.getCorner(i + 1);
                    const a1 = t1Corner.center.angleTo(t2Corner.center);
                    const a2 = t1Corner.center.angleTo(nextCorner.center);
                    const rel = Utils.solveAngle(a2 - a1);

                    t2Corner.exterior = rel >= 0 && rel < Math.PI;

                }

                if (prev == null) {
                    t1Corner.exterior = t2Corner.exterior;
                } else if (next == null) {
                    t2Corner.exterior = t1Corner.exterior;
                }

                const R1 = t1Corner.radius;
                const R2 = t2Corner.radius;
                const D = t1Corner.center.distTo(t2Corner.center);

                let THETA = t1Corner.center.angleTo(t2Corner.center);

                if (t1Corner.exterior === t2Corner.exterior) {

                    if (R1 > R2) {

                        const R3 = R1 - R2;
                        const H = Math.sqrt(D * D + R3 * R3);
                        const Y = Math.sqrt(H * H + R2 * R2);
                        THETA += Math.acos((R1 * R1 + D * D - Y * Y) / (2 * R1 * D));

                    } else if (R1 < R2) {

                        const R3 = R2 - R1;
                        const H = Math.sqrt(D * D + R3 * R3);
                        const Y = Math.sqrt(H * H + R1 * R1);
                        THETA += Math.acos((R2 * R2 + D * D - Y * Y) / (2 * R2 * D));

                    } else {
                        THETA += Utils.HALF_PI;
                    }

                    t1Corner.attachNext.x = Utils.addOrSub(t1Corner.center.x, Math.cos(THETA) * t1Corner.radius, t1Corner.exterior);
                    t1Corner.attachNext.y = Utils.addOrSub(t1Corner.center.y, Math.sin(THETA) * t1Corner.radius, t1Corner.exterior);
                    t2Corner.attachPrev.x = Utils.addOrSub(t2Corner.center.x, Math.cos(THETA) * t2Corner.radius, t2Corner.exterior);
                    t2Corner.attachPrev.y = Utils.addOrSub(t2Corner.center.y, Math.sin(THETA) * t2Corner.radius, t2Corner.exterior);

                    t1Corner.angleNext = THETA - (t1Corner.exterior ? Math.PI : 0);
                    t2Corner.anglePrev = THETA - (t2Corner.exterior ? Math.PI : 0);

                } else {

                    const R3 = R1 + R2;
                    const L = Math.sqrt(D * D - R3 * R3);
                    THETA = Utils.addOrSub(THETA, Math.acos(L / D) - Utils.HALF_PI, !t1Corner.exterior);

                    t1Corner.attachNext.x = t1Corner.center.x + Math.cos(THETA) * t1Corner.radius;
                    t1Corner.attachNext.y = t1Corner.center.y + Math.sin(THETA) * t1Corner.radius;
                    t2Corner.attachPrev.x = t2Corner.center.x + Math.cos(THETA + Math.PI) * t2Corner.radius;
                    t2Corner.attachPrev.y = t2Corner.center.y + Math.sin(THETA + Math.PI) * t2Corner.radius;

                    t1Corner.angleNext = THETA;
                    t2Corner.anglePrev = THETA + Math.PI;

                }

            }

        });

    }

    Map.prototype.getSector = function(pos) {

        let sector = null;

        this.eachGroup((t1, t2, idx) => {

            if (Utils.isPointIn(pos, [t1.corner1.attachNext, t1.corner2.attachNext, t2.corner2.attachPrev, t2.corner1.attachPrev])) {
                sector = idx << 1;
                return false;
            }

            if (t2.next != null) {

                const polygon = [];
                const corner1AngleInc = Utils.TWO_PI / t2.corner1.radius;
                const corner2AngleInc = Utils.TWO_PI / t2.corner2.radius;

                for (let t = t2.corner1.anglePrev; Math.abs(Utils.plusMinusAngle(t2.corner1.angleNext - t)) > corner1AngleInc; t = Utils.addOrSub(t, corner1AngleInc, !t2.corner1.exterior)) {
                    polygon.push(new Utils.Point(t2.corner1.center.x + Math.cos(t) * t2.corner1.radius, t2.corner1.center.y + Math.sin(t) * t2.corner1.radius));
                }
                polygon.push(t2.corner1.attachNext);

                for (let t = t2.corner2.angleNext; Math.abs(Utils.plusMinusAngle(t2.corner2.anglePrev - t)) > corner2AngleInc; t = Utils.addOrSub(t, corner2AngleInc, t2.corner2.exterior)) {
                    polygon.push(new Utils.Point(t2.corner2.center.x + Math.cos(t) * t2.corner2.radius, t2.corner2.center.y + Math.sin(t) * t2.corner2.radius));
                }
                polygon.push(t2.corner2.attachPrev);

                if (Utils.isPointIn(pos, polygon)) {
                    sector = (idx << 1) + 1;
                    return false;
                }

            }

        });

        return sector;

    }

    function Turn(x, y, length, r1, r2) {

        this.center = new Utils.Point(x, y);
        this.angle = 0;
        this.pangle = 0;
        this.length = length;

        this.corner1 = new TurnCorner(r1);
        this.corner2 = new TurnCorner(r2);

        this.prev = null;
        this.next = null;

    }

    Turn.prototype.getCorner = function(num) {
        return this["corner" + num];
    }

    Turn.prototype.getAngleTo = function(other) {
        return this.center.angleTo(other.center);
    }

    Turn.prototype.ifPrev = function(cb) {
        if (this.prev !== null) cb(this.prev);
    }

    Turn.prototype.ifNext = function(cb) {
        if (this.next !== null) cb(this.next);
    }

    Turn.prototype.anglePrev = function() {
        return this.getAngleTo(this.prev) - Math.PI;
    }

    Turn.prototype.angleNext = function() {
        return this.getAngleTo(this.next);
    }

    Turn.prototype.updateCache = function() {

        if (this.prev === null && this.next === null) {
            this.angle = 0;
        } else if (this.prev === null) {
            this.angle = this.angleNext();
        } else if (this.next === null) {
            this.angle = this.anglePrev();
        } else {
            this.angle = Utils.averageAngle([this.angleNext(), this.anglePrev()]);
        }

        this.pangle = this.angle - Utils.HALF_PI;

        const dx = Math.cos(this.pangle) * this.length * 0.5;
        const dy = Math.sin(this.pangle) * this.length * 0.5;

        this.corner1.center.x = this.center.x + dx;
        this.corner1.center.y = this.center.y + dy;
        this.corner2.center.x = this.center.x - dx;
        this.corner2.center.y = this.center.y - dy;

    }

    function TurnCorner(radius) {
        this.radius = radius;
        this.center = new Utils.Point();
        this.attachPrev = new Utils.Point();
        this.attachNext = new Utils.Point();
        this.anglePrev = 0;
        this.angleNext = 0;
        this.exterior = false;
    }

    return {
        Map: Map,
        Turn: Turn
    }

})();

const Race = (function(){

    const MIN_DIRECTION = -0.03;
    const MAX_DIRECTION = 0.03;
    const DIRECTION_VARIATION = 0.001;
    const DIRECTION_SLOWDOWN = 0.85;

    const MIN_SPEED = -2;
    const MAX_SPEED = 3;
    const FORWARD_ACCEL = 0.1;
    const BACKWARD_ACCEL = 0.2;
    const SPEED_SLOWDOWN = 0.95;

    function Race(map) {
        this.map = map;
        this.cars = [];
    }

    Race.prototype.newCar = function() {

        const car = new Car(this);

        if (this.map.turns.length < 2) {
            car.pos.x = 200 + Math.random() * 100;
            car.pos.y = 200 + Math.random() * 100;
        } else {

            const turn = this.map.turns[0];
            const midX = (turn.corner1.attachNext.x + turn.corner2.attachNext.x) / 2;
            const midY = (turn.corner1.attachNext.y + turn.corner2.attachNext.y) / 2;

            car.pos.x = midX;
            car.pos.y = midY;
            car.angle = turn.angle;

        }

        this.cars.push(car);
        return car;

    }

    Race.prototype.eachCar = function(cb) {
        this.cars.forEach(cb);
    }

    Race.prototype.update = function() {

        this.eachCar((car) => {

            if (Game.isKeyDown("KeyS")) {
                car.backward();
            } else if (Game.isKeyDown("KeyW")) {
                car.forward();
            } else {
                car.speedSlowDown();
            }

            if (Game.isKeyDown("KeyA")) {
                car.turnLeft();
            } else if (Game.isKeyDown("KeyD")) {
                car.turnRight();
            } else {
                car.directionSlowDown();
            }

            car.angle = Utils.solveAngle(car.angle + (car.direction * (car.speed / MAX_SPEED)));
            car.motion.x = Math.cos(car.angle) * car.speed;
            car.motion.y = Math.sin(car.angle) * car.speed;
            car.pos.x += car.motion.x;
            car.pos.y += car.motion.y;
            car.updateCase();

        });

    };

    function Car(race, x, y) {

        this.race = race;
        this.pos = new Utils.Point(x, y);
        this.angle = 0;
        this.sector = null;

        this.casePoints = [
            new Utils.Point(),
            new Utils.Point(),
            new Utils.Point(),
            new Utils.Point()
        ];

        this.updateCase();

        this.speed = 0;
        this.direction = 0;

        this.motion = new Utils.Point();

    }

    Car.prototype.updateCase = function() {
        this.casePoints[0].x = this.pos.x + Math.cos(this.angle + Math.PI / 4) * 10;
        this.casePoints[0].y = this.pos.y + Math.sin(this.angle + Math.PI / 4) * 10;
        this.casePoints[1].x = this.pos.x + Math.cos(this.angle + (3*Math.PI) / 4) * 10;
        this.casePoints[1].y = this.pos.y + Math.sin(this.angle + (3*Math.PI) / 4) * 10;
        this.casePoints[2].x = this.pos.x + Math.cos(this.angle + (5*Math.PI) / 4) * 10;
        this.casePoints[2].y = this.pos.y + Math.sin(this.angle + (5*Math.PI) / 4) * 10;
        this.casePoints[3].x = this.pos.x + Math.cos(this.angle + (7*Math.PI) / 4) * 10;
        this.casePoints[3].y = this.pos.y + Math.sin(this.angle + (7*Math.PI) / 4) * 10;
    }

    Car.prototype.backward = function() {
        this.speed -= BACKWARD_ACCEL;
        if (this.speed < MIN_SPEED)
            this.speed = MIN_SPEED;
    }

    Car.prototype.forward = function() {
        this.speed += FORWARD_ACCEL;
        if (this.speed > MAX_SPEED)
            this.speed = MAX_SPEED;
    }

    Car.prototype.speedSlowDown = function() {
        this.speed *= SPEED_SLOWDOWN;
    }

    Car.prototype.turnLeft = function() {
        this.direction -= DIRECTION_VARIATION;
        if (this.direction < MIN_DIRECTION)
            this.direction = MIN_DIRECTION;
    }

    Car.prototype.turnRight = function() {
        this.direction += DIRECTION_VARIATION;
        if (this.direction > MAX_DIRECTION)
            this.direction = MAX_DIRECTION;
    }

    Car.prototype.directionSlowDown = function() {
        this.direction *= DIRECTION_SLOWDOWN;
    }

    return {
        Race: Race,
        Car: Car
    }

})();

const Utils = (function(){

    const TWO_PI = Math.PI * 2;
    const HALF_PI = Math.PI * 0.5;

    function Point(x, y) {
        this.x = x == null ? 0 : x;
        this.y = y == null ? 0 : y;
    }

    Point.prototype.distTo = function(other) {
        return this.distToRaw(other.x, other.y);
    }

    Point.prototype.distToRaw = function(ox, oy) {
        const dx = ox - this.x;
        const dy = oy - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    Point.prototype.angleTo = function(other) {
        return angleBetween(this.x, this.y, other.x, other.y);
    }

    Point.prototype.equalsTo = function(other) {
        return this.x === other.x && this.y === other.y;
    }

    function solveAngle(angle) {
        return angle < 0 ? (angle + TWO_PI) : angle;
    }

    function plusMinusAngle(angle) {
        const f = Math.floor(angle / TWO_PI);
        angle -= f * TWO_PI;
        return (angle > Math.PI) ? (angle - TWO_PI) : angle;
    }

    function angleBetween(x1, y1, x2, y2) {
        return solveAngle(Math.atan2(y2 - y1, x2 - x1));
    }

    function toDegrees(rad) {
        return rad / Math.PI * 180;
    }

    function averageAngle(angles) {
        let x = 0, y = 0;
        angles.forEach(angle => {
            x += Math.cos(angle);
            y += Math.sin(angle);
        })
        return Math.atan2(y, x);
    }

    function addOrSub(n, m, sub) {
        return sub ? (n - m) : (n + m);
    }

    function isPointIn(pt, polygon) {

        if (polygon.length === 0) {
            return false;
        } else if (polygon.length === 1) {
            return polygon[0].equalsTo(pt);
        } else if (polygon.length === 1) {
            const productSegment = polygon[0].x * polygon[0].x + polygon[0].y * polygon[1].y;
            const productPoint = polygon[0].x * pt.x + polygon[0].y * pt.y;
            return productPoint >= 0 && productPoint <= productSegment;
        } else {

            polygon.push(polygon[0]); // Push the first point to the end to close polygon

            let lastAngle = pt.angleTo(polygon[0]);
            let newAngle, delta;
            let gainDelta = 0;
            let lostDelta = 0;

            for (let i = 1; i < polygon.length; ++i) {
                newAngle = pt.angleTo(polygon[i]);
                delta = plusMinusAngle(newAngle - lastAngle);
                if (delta > 0) {
                    gainDelta += delta;
                } else {
                    lostDelta -= delta;
                }
                lastAngle = newAngle;
            }

            return Math.abs(gainDelta - lostDelta) > 0.01;

        }

    }

    return {
        TWO_PI: TWO_PI,
        HALF_PI: HALF_PI,
        Point: Point,
        solveAngle: solveAngle,
        plusMinusAngle: plusMinusAngle,
        angleBetween: angleBetween,
        toDegrees: toDegrees,
        averageAngle: averageAngle,
        addOrSub: addOrSub,
        isPointIn: isPointIn
    }

})();