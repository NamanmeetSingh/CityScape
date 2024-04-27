import { BuildingType } from './buildingType.js';
import { mini} from './zones/mini.js';
import { ResidentialZone } from './zones/OBHK.js';
import { Building } from './building.js';
import { TBHK } from './zones/TBHK.js';
import { CBHK } from './zones/CBHK.js';
import {  macro } from './zones/macro.js';
import { large } from './zones/large.js';
import { bank } from './zones/Bank.js';
import { Concert } from './zones/Concert.js';
import { firestation } from './zones/firestation.js';
import { Hospital } from './zones/Hospital.js';
import { Police } from './zones/Policestation.js';
import { Restaurent } from './zones/Restaurent.js';
import { School } from './zones/School.js';
import { SM } from './zones/SM.js';
import { TH } from './zones/TH.js';


/**
 * 
 * Creates a new building object
 * @param {number} x The x-coordinate of the building
 * @param {number} y The y-coordinate of the building
 * @param {string} type The building type
 * @returns {Building} A new building object
 */
export function createBuilding(x, y, type, City) {
  
  switch (type) {
    case BuildingType.residential:
      return new ResidentialZone();
      case BuildingType.macro: 
      return new macro();
      case BuildingType.TBHK:
        return new TBHK();
      case BuildingType.CBHK:
        return new CBHK();
    case BuildingType.mini: 
      return new mini();
    case BuildingType.large: 
      return new large();
    case BuildingType.bank:
      return new bank();
    case BuildingType.Concert:
      return new Concert();
    case BuildingType.firestation:
      return new firestation();
    case BuildingType.Hospital:
      return new Hospital();
    case BuildingType.Police:
      return new Police();
    case BuildingType.Restaurent:
      return new Restaurent();
    case BuildingType.School:
      return new School();
    case BuildingType.SM:
      return new SM();
      case BuildingType.TH:
        return new TH();


    default:
      console.error(`${type} is not a recognized building type.`);
  }
}