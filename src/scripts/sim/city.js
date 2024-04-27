import * as THREE from "three";
import { BuildingType } from "./buildings/buildingType.js";
import { createBuilding } from "./buildings/buildingFactory.js";
import { Tile } from "./tile.js";
import { PowerService } from "./services/power.js";
import { SimService } from "./services/simService.js";

function isSpecialBuilding(buildingType) {
  // Add the building types that you consider as special buildings
  return buildingType === BuildingType.Concert || buildingType === BuildingType.SM || buildingType === BuildingType.Restaurent;
}

export class City extends THREE.Group {

  revenueUpdateInterval = 60 * 1000;
  budgetUpdateInterval = 120 * 1000;
  burnStartTime = null;
  hospitalRevenueReductionStartTime = null;
  houseRevenueReductionStartTime = null;
  plagueSituationStartTime = null;
  vaccineHasPurchased = false;
  marketRevenueDeductionStartTime = null;
  cashPaymentMade = false;
  concertStoppageAndCharityDeductionStartTime = null;
  specialBuildingCoordinates = [];
  teamPaymentAndPublicHolidayStartTime = null;
  seasonalMarketRevenueReductionStartTime = null;

  buildingRevenue = {
    TH: 500,
   residential: 100, 
    TBHK: 160,
    CBHK: 260,
    mini: 250,
    macro: 350,
    large: 500,
    bank: 3000,
    firestation: 0,
    Hospital: 0,  
    Police: 0,
    School: 500,
    SM: 1000,
    Concert: 3000,
    Restaurent: 750,
  };

  createMessageBoxHTML(message) {
    const messageBoxHTML = `
      <div id="messageBox" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border: 1px solid black; z-index: 9999;">
        <p>${message}</p>
        <button id="closeButton">Close</button>
      </div>
    `;
    return messageBoxHTML;
  }

  displayNotification(message) {
    const messageBoxHTML = this.createMessageBoxHTML(message);
    const messageBoxContainer = document.createElement('div');
    messageBoxContainer.innerHTML = messageBoxHTML;
    document.body.appendChild(messageBoxContainer);
  
    const closeButton = document.getElementById('closeButton');
    closeButton.addEventListener('click', () => {
      document.body.removeChild(messageBoxContainer);
    });
  }

  stabilizeBuilding(x, y) {
    const tile = this.getTile(x, y);
    if (tile?.building && this.specialBuildingCoordinates.some(coord => coord.x === x && coord.y === y)) {
      const stabilizationCost = 100;
      if (this.budget >= stabilizationCost) {
        this.budget -= stabilizationCost;
        tile.building.isStabilized = true;
        this.updateBudgetDisplay(ui);
      } else {
        console.error("Not enough funds to stabilize the building. Required: ${stabilizationCost}");
      }
    }
  }

  

  currentMessageIndex = 0;
  notificationMessages = [
    'Robbery: Any building not placed within the proximity of police station will generate no revenue for the next round.',
    'Fire: Buildings outside the proximity of a fire station will get burnt and generate no revenue. (Repair cost = Rs. 50 per building)',
    'Earthquake: Houses outside the proximity of a hospital will generate no revenue in the next round and the rest of the buildings will generate revenue as it is. Special buildings will only generate 50% revenue until made stable. (Stabilising cost = Rs. 100 per building)',
    'Police Raid: Each house revenue will be cut by 50%.',
    'Plague: Each buildings revenue will be reduced by 25% in each round unless they get a vaccine for the whole map. (Vaccination cost = Rs. 2500 full map)',
    'Demand & Supply Shortage: Each markets revenue will be deducted by Rs. 100 in every round until and unless they are supplied with surplus cash amount of Rs. 1000.',
    'Festival: An amount of Rs. 500 will be given to each team. However, due to public holiday, the bank as well as schools will remain closed and will thus generate no revenue.',
    'Stampede: There has been a crowd issue in your concert, hence, there will be no further generation of revenue from the concert further. There will be further 10% deduction from total revenue in the name of charity for those injured.',
    'Excessive Rainfall: Due to excessive rainfall, the seasonal market revenue has been cut by 50%.'
  ];

  isInPoliceStationProximity(x, y) {
    // Iterate through the policeStationCoordinates array
    for (const coord of this.policeStationCoordinates) {
      // Check if the building is within a certain distance from the police station
      if (Math.abs(coord.x - x) <= 5 && Math.abs(coord.y - y) <= 5) {
        return true;
      }
    }
    return false;
  }

  isInHospitalProximity(x, y) {
    // Iterate through the hospitalCoordinates array
    for (const coord of this.hospitalCoordinates) {
      // Check if the building is within a certain distance from the hospital
      if (Math.abs(coord.x - x) <= 2 && Math.abs(coord.y - y) <= 2) {
        return true;
      }
    }
    return false;
  }

  isInFireStationProximity(x, y) {
    // Iterate through the fireStationCoordinates array
    for (const coord of this.fireStationCoordinates) {
      // Check if the building is within a certain distance from the fire station
      if (Math.abs(coord.x - x) <= 5 && Math.abs(coord.y - y) <= 5) {
        return true;
      }
    }
    return false;
  }

  startNotificationInterval() {
    this.notificationInterval = setInterval(() => {
      // Check if we've reached the end of the array
      if (this.currentMessageIndex >= this.notificationMessages.length) {
        // Stop the interval
        clearInterval(this.notificationInterval);
        return;
      }
  
      // Get the current message
      const message = this.notificationMessages[this.currentMessageIndex];
  
      // Call the displayNotification method with the current message
      this.displayNotification(message);
  
      // Increment the currentMessageIndex
      this.currentMessageIndex++;
    }, 900000);
  }

  showVaccinePurchaseMessageBox() {
    const message = `A plague situation has occurred! Purchase the vaccine for $2500 to prevent a 25% revenue reduction for all buildings.`;
    const confirmPurchase = confirm(message);
  
    if (confirmPurchase) {
      if (this.budget >= 2500) {
        this.budget -= 2500;
        this.vaccineHasPurchased = true;
        this.updateBudgetDisplay(ui);
      } else {
        alert("You don't have enough funds to purchase the vaccine.");
      }
    }
  }

  generateRevenue() {
    const currentTime = Date.now();
    let totalRevenue = 0;
  
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (tile?.building) {
          const buildingType = tile.building.type;
          const revenuePerBuilding = this.buildingRevenue[buildingType] || 0;
          let elapsedTime = (currentTime - tile.building.placedAt)/(1000*60); // Convert to days
          if (this.isInPoliceStationProximity(x, y) || this.timeElapsedSinceLogin < 120000) {
            totalRevenue += revenuePerBuilding * elapsedTime;
          } else if (this.burnStartTime && !this.isInFireStationProximity(x, y)) {
            tile.building.isBurned = true; // Mark the building as burned
          }

          elapsedTime = (currentTime - tile.building.placedAt) / (1000 * 60 * 60 * 24);

          let revenueMultiplier = 1;
          let revenueDeduction = 0;
          if (this.marketRevenueDeductionStartTime && !this.cashPaymentMade && buildingType === BuildingType.market) {
            revenueDeduction = 100;
          }
          if (this.seasonalMarketRevenueReductionStartTime && buildingType === BuildingType.SeasonalMarket) {
            revenueMultiplier = 0.5;
          }
          if (this.plagueSituationStartTime && !this.vaccineHasPurchased) {
            revenueMultiplier = 0.75;
          }
          if (this.teamPaymentAndPublicHolidayStartTime && (buildingType === BuildingType.bank || buildingType === BuildingType.School)) {
            revenueDeduction = revenuePerBuilding * elapsedTime;
          }
          if (this.concertStoppageAndCharityDeductionStartTime && buildingType === BuildingType.Concert) {
            revenueDeduction = revenuePerBuilding * elapsedTime; // No revenue for concert buildings
          }

          const isSpecialBuilding = this.specialBuildingCoordinates.some(coord => coord.x === x && coord.y === y);
          if (this.hospitalRevenueReductionStartTime && !this.isInHospitalProximity(x, y) && tile.building.type === BuildingType.residential) {

            continue;
          } else if (isSpecialBuilding && !tile.building.isStabilized) {
            totalRevenue += revenuePerBuilding * elapsedTime * revenueMultiplier - revenueDeduction;
          } else {
            totalRevenue += revenuePerBuilding * elapsedTime * revenueMultiplier -revenueDeduction;
          }

          if (this.houseRevenueReductionStartTime && buildingType === BuildingType.residential) {
            totalRevenue += revenuePerBuilding * elapsedTime * revenueMultiplier - revenueDeduction;
          } else if (this.hospitalRevenueReductionStartTime && !this.isInHospitalProximity(x, y) && tile.building.type === BuildingType.residential) {
            continue;
          } else if (this.specialBuildingCoordinates.some(coord => coord.x === x && coord.y === y) && !tile.building.isStabilized) {
            totalRevenue += revenuePerBuilding * elapsedTime * revenueMultiplier - revenueDeduction;
          } else {
            totalRevenue += revenuePerBuilding * elapsedTime * revenueMultiplier - revenueDeduction;
          }
        }
      }
    }
    if (this.concertStoppageAndCharityDeductionStartTime) {
      totalRevenue *= 0.9; 
    }
    return totalRevenue;
  }

  repairBuilding(x, y) {
    const tile = this.getTile(x, y);
    if (tile?.building && tile.building.isBurned) {
      const repairCost = 50;
      if (this.budget >= repairCost) {
        this.budget -= repairCost;
        tile.building.isBurned = false;
        this.updateBudgetDisplay(ui);
      } else {
        console.error("Not enough funds to repair the building. Required: ${repairCost}");
      }
    }
  }

  calculateRevenue() {
    return this.generateRevenue();
  }

  updateBudget() {
    const revenue = this.calculateRevenue();
    this.budget += revenue;
    this.updateBudgetDisplay(ui);
  }

  updateBudgetDisplay(ui) {
    console.log("Budget:", this.budget);
    ui.updateBudgetDisplay(this.budget);
  }
  /**
   * Separate group for organizing debug meshes so they aren't included
   * in raycasting checks
   * @type {THREE.Group}
   */
  debugMeshes = new THREE.Group();
  /**
   * Root node for all scene objects
   * @type {THREE.Group}
   */
  root = new THREE.Group();
  /**
   * The budget of the city
   * @type {number}
   */
  budget = 4000;

  /** Building costs
   * */
  buildingCost = {
    residential: 300,
    TBHK: 500,
    CBHK: 800,
    mini: 500,
    macro: 700,
    large: 1000,
    bank: 2000,
    firestation: 300,
    Hospital: 500,
    Police : 250,
    School: 500,
    SM: 500,
    Concert: 1500,
    Restaurent: 500,
    TH:0,

  };
  /**
   * List of services for the city
   * @type {SimService}
   */
  services = [];
  /**
   * The size of the city in tiles
   * @type {number}
   */
  size = 25;
  /**
   * The current simulation time
   */
  simTime = 0;
  /**
   * 2D array of tiles that make up the city
   * @type {Tile[][]}
   */
  tiles = [];

  revenueUpdateInterval = 60 * 1000; // 15 minutes in milliseconds

  constructor(size, name = "CITYSCAPE") {
    super();

    this.policeStationCoordinates = [];
    this.lastRevenueUpdate = 0; // Initialize the lastRevenueUpdate variable
    this.buildingCooldown = 0;
    this.updateBudgetDisplay(ui); // Update the budget display on initial load
    this.name = name;
    this.size = size;
    this.elapsedMinutes = 0; // Initialize elapsedMinutes to 0

    this.add(this.debugMeshes);
    this.add(this.root);

    this.tiles = [];

    // Calculate the center coordinates
    const centerX = Math.floor(this.size / 2);
    const centerY = Math.floor(this.size / 2);

    // Create tiles with (0, 0) at the top-left corner
    for (let y = 0; y < this.size; y++) {
      const column = [];
      for (let x = 0; x < this.size; x++) {
        const tile = new Tile(x, y);
        tile.refreshView(this);
        this.root.add(tile);
        column.push(tile);
      }
      this.tiles.push(column);
    }

    this.services = [];
    this.services.push(new PowerService());
    // Place the TownHall building at the center
    this.placeBuilding(24, 24, BuildingType.TH, this);

    this.startNotificationInterval();
  }

  
  get population() {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        population += tile.building?.residents?.count ?? 0;
      }
    }
    return population;
  }

  /** Returns the title at the coordinates. If the coordinates
   * are out of bounds, then null is returned.
   * @param {number} x The x-coordinate of the tile
   * @param {number} y The y-coordinate of the tile
   * @returns {Tile | null}
   */
  getTile(x, y) {
    if (
      x === undefined ||
      y === undefined ||
      x < 0 ||
      y < 0 ||
      x >= this.size ||
      y >= this.size ||
      !this.tiles || // Add this check
      !this.tiles[x]
    ) {
      return null;
    } else {
      return this.tiles[y][x];
    }
  }

  /**
   * Step the simulation forward by one step
   * @type {number} steps Number of steps to simulate forward in time
   */
  simulate(steps = 1) {
    let count = 0;
    while (count++ < steps) {
      // Update services
      this.services.forEach((service) => service.simulate(this));

      // Update each building
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          this.getTile(x, y).simulate(this);
        }
      }

      // Decrement the buildingCooldown
      if (this.buildingCooldown > 0) {
        this.buildingCooldown--;
      }
    }
    this.simTime++;
}

  /**
   * Places a building at the specified coordinates if the
   * tile does not already have a building on it
   * @param {number} x
   * @param {number} y
   * @param {string} buildingType
   */

  placeBuilding(x, y, buildingType, city) {
    if (buildingType === BuildingType.Police) {
      this.policeStationCoordinates.push({x, y});
    }
    if (buildingType === BuildingType.firestation) {
      this.fireStationCoordinates.push({ x, y });
    }
    if (buildingType === BuildingType.Hospital) {
      this.hospitalCoordinates.push({ x, y });
    }
    if (isSpecialBuilding(buildingType)) {
      this.specialBuildingCoordinates.push({ x, y });
    }

    if (this.buildingCooldown > 0) {
      console.error("Cannot place a building during cooldown (remaining: ${this.buildingCooldown} minutes)");
      console.log(this.buildingCooldown);
      console.log(this.simTime)
      return;
    }

    const building = createBuilding(x, y, buildingType, this);
    if (!building) return; // Exit if building creation failed

    const size = building.size;
    const cost = this.buildingCost[buildingType];

    // Check if the city has enough budget
    if (this.budget < cost) {
      console.error(
        "Not enough funds to place ${buildingType} building. Required: ${cost}"
      );
      return;
    }

    // Check if there's enough space to place the building
    for (let i = x; i < x + size; i++) {
      for (let j = y; j < y + size; j++) {
        const tile = this.getTile(i, j);
        if (tile && tile.building) {
          return;
        }
      }
    }

    // Deduct the cost from the city's budget
    this.budget -= cost;
    this.updateBudgetDisplay(ui); // Update the budget display after deducting the cost

    for (let i = x; i < x + size; i++) {
      for (let j = y; j < y + size; j++) {
        const tile = this.getTile(i, j);
        if (tile) { // Add this check
          tile.setBuilding(building);
          tile.refreshView(this);
        }
      }
    }

    // Update neighboring tiles for road connections
    for (let i = x - 1; i <= x + size; i++) {
      for (let j = y - 1; j <= y + size; j++) {
        const tile = this.getTile(i, j);
        if (tile) {
          tile.refreshView(this);
        }
      }
    }
  }

  showCashPaymentMessageBox() {
    const message = `Each market's revenue will be deducted by $100 unless a cash amount of $1000 is paid.`;
    const confirmPayment = confirm(message);
  
    if (confirmPayment) {
      if (this.budget >= 1000) {
        this.budget -= 1000;
        this.cashPaymentMade = true;
        this.updateBudgetDisplay(ui);
      } else {
        alert("You don't have enough funds to make the cash payment.");
      }
    }
  }

  handleTeamPaymentAndPublicHoliday() {
    const teamPaymentAmount = 500;
    this.budget += teamPaymentAmount;
    this.updateBudgetDisplay(ui);
    console.log(`Received team payment of $${teamPaymentAmount}`);
  }

  bulldoze(x, y) {
    const tile = this.getTile(x, y);

    if (tile.building) {
      const size = tile.building.size;
      const buildingType = tile.building.type;
      const refundAmount = this.buildingCost[buildingType] * 0.5;
      if (tile.building.type === BuildingType.road) {
      }else{
        this.budget += refundAmount;
        this.updateBudgetDisplay(ui); // Update the budget display after adding the cost
      }

      // Remove the building from multiple tiles
      for (let i = x; i < x + size; i++) {
        for (let j = y; j < y + size; j++) {
          const tile = this.getTile(i, j);
          tile.building.dispose();
          tile.setBuilding(null);
          tile.refreshView(this);
        }
      }

      // Update neighboring tiles for road connections
      for (let i = x - 1; i <= x + size; i++) {
        for (let j = y - 1; j <= y + size; j++) {
          const tile = this.getTile(i, j);
          if (tile) {
            tile.refreshView(this);
          }
        }
      }
      this.buildingCooldown = 180;

    }
  }

  draw() {
    // this.vehicleGraph.updateVehicles();
  }

  /**
   * Finds the first tile where the criteria are true
   * @param {{x: number, y: number}} start The starting coordinates of the search
   * @param {(Tile) => (boolean)} filter This function is called on each
   * tile in the search field until filter returns true, or there are
   * no more tiles left to search.
   * @param {number} maxDistance The maximum distance to search from the starting tile
   * @returns {Tile | null} The first tile matching criteria, otherwiser null
   */
  findTile(start, filter, maxDistance) {
    const startTile = this.getTile(start.x, start.y);
    const visited = new Set();
    const tilesToSearch = [];

    // Initialze our search with the starting tile
    tilesToSearch.push(startTile);

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift();

      // Has this tile been visited? If so, ignore it and move on
      if (visited.has(tile.id)) {
        continue;
      } else {
        visited.add(tile.id);
      }

      // Check if tile is outside the search bounds
      const distance = startTile.distanceTo(tile);
      if (distance > maxDistance) continue;

      // Add this tiles neighbor's to the search list
      tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

      // If this tile passes the criteria
      if (filter(tile)) {
        return tile;
      }
    }

    return null;
  }

simulate(deltaTime) {

  this.timeElapsedSinceLogin += deltaTime;
  // Update services
  this.services.forEach((service) => service.simulate(this, deltaTime));

  // Update each building
  for (let x = 0; x < this.size; x++) {
    for (let y = 0; y < this.size; y++) {
      this.getTile(x, y).simulate(this, deltaTime);
    }
  }

  const elapsedMinutes = this.timeElapsedSinceLogin / (1000 * 60);
  if (elapsedMinutes >= 30 && elapsedMinutes < 45 && !this.burnStartTime) {
    this.burnStartTime = Date.now();
  }
  if (elapsedMinutes >= 45 && elapsedMinutes < 60 && !this.hospitalRevenueReductionStartTime) {
    this.hospitalRevenueReductionStartTime = Date.now();
  }
  if (elapsedMinutes >= 60 && elapsedMinutes < 75 && !this.houseRevenueReductionStartTime) {
    this.houseRevenueReductionStartTime = Date.now();
  }
  if (elapsedMinutes >= 75 && !this.plagueSituationStartTime && !this.vaccineHasPurchased) {
    this.plagueSituationStartTime = Date.now();
    this.showVaccinePurchaseMessageBox();
  }
  if (elapsedMinutes >= 90 && !this.marketRevenueDeductionStartTime && !this.cashPaymentMade) {
    this.marketRevenueDeductionStartTime = Date.now();
    this.showCashPaymentMessageBox();
  }
  if (elapsedMinutes >= 105 && !this.teamPaymentAndPublicHolidayStartTime) {
    this.teamPaymentAndPublicHolidayStartTime = Date.now();
    this.handleTeamPaymentAndPublicHoliday();
  }
  if (elapsedMinutes >= 120 && !this.concertStoppageAndCharityDeductionStartTime) {
    this.concertStoppageAndCharityDeductionStartTime = Date.now();
  }
  if (elapsedMinutes >= 135 && !this.seasonalMarketRevenueReductionStartTime) {
    this.seasonalMarketRevenueReductionStartTime = Date.now();
  }

  // Decrement the buildingCooldown in milliseconds
  if (this.buildingCooldown > 0) {
    this.buildingCooldown -= deltaTime;
  }

  const currentTime = Date.now();
  const elapsedTimeRevenue = currentTime - this.lastRevenueUpdate;

  if (elapsedTimeRevenue >= this.revenueUpdateInterval) {
    this.updateBudget();
    this.lastRevenueUpdate = currentTime; 
  }

  const elapsedTimeBudget = currentTime - this.lastBudgetUpdate;

  if (elapsedTimeBudget >= this.budgetUpdateInterval) {
    this.budget += this.generateRevenue(); 
    this.updateBudget(ui) 
    this.lastBudgetUpdate = currentTime;
  }
}
  /**
   * Finds and returns the neighbors of this tile
   * @param {number} x The x-coordinate of the tile
   * @param {number} y The y-coordinate of the tile
   */
  getTileNeighbors(x, y) {
    const neighbors = [];

    if (x > 0) {
      neighbors.push(this.getTile(x - 1, y));
    }
    if (x < this.size - 1) {
      neighbors.push(this.getTile(x + 1, y));
    }
    if (y > 0) {
      neighbors.push(this.getTile(x, y - 1));
    }
    if (y < this.size - 1) {
      neighbors.push(this.getTile(x, y + 1));
    }

    return neighbors;
  }
}