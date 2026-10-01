/**
 * Starting geography (PRD §4). Submarket names follow Stream's published DFW and
 * Houston industrial reports; compound submarkets stay combined as published.
 * The city lists are a first pass for operations to correct on the Geography screen.
 */
export const GEOGRAPHY_SEED: {
  market: string;
  state: string;
  submarkets: string[];
  cities: string[];
}[] = [
  {
    market: "Dallas",
    state: "TX",
    submarkets: [
      "Denton",
      "Lewisville",
      "DFW Airport",
      "South Stemmons",
      "Dallas CBD",
      "North Stemmons–Valwood–Metro Addison",
      "Pinnacle–Lonestar–Turnpike",
      "Great Southwest–Arlington",
      "South Dallas",
      "287 Corridor",
      "121 Corridor–Frisco",
      "McKinney–Allen",
      "Richardson–Plano",
      "Northeast Dallas–Garland–Mesquite",
    ],
    cities: [
      "Dallas", "Addison", "Allen", "Anna", "Argyle", "Arlington", "Balch Springs", "Carrollton", "Cedar Hill",
      "Celina", "Cockrell Hill", "Coppell", "Corinth", "DeSoto", "Denton", "Duncanville", "Ennis", "Euless",
      "Farmers Branch", "Ferris", "Flower Mound", "Forney", "Frisco", "Garland", "Glenn Heights", "Grand Prairie",
      "Grapevine", "Highland Park", "Hutchins", "Irving", "Krum", "Lancaster", "Lewisville", "Little Elm",
      "Mansfield", "McKinney", "Melissa", "Mesquite", "Midlothian", "Murphy", "Ovilla", "Palmer", "Plano",
      "Princeton", "Prosper", "Red Oak", "Richardson", "Rockwall", "Rowlett", "Royse City", "Sachse",
      "Sanger", "Seagoville", "Sunnyvale", "Terrell", "The Colony", "University Park", "Waxahachie", "Wilmer",
      "Wylie",
    ],
  },
  {
    market: "Fort Worth",
    state: "TX",
    submarkets: ["North Fort Worth", "South Fort Worth"],
    cities: [
      "Fort Worth", "Aledo", "Azle", "Bedford", "Benbrook", "Blue Mound", "Burleson", "Crowley", "Everman",
      "Forest Hill", "Haltom City", "Haslet", "Hurst", "Joshua", "Justin", "Keller", "Kennedale", "Lake Worth",
      "North Richland Hills", "Northlake", "Richland Hills", "River Oaks", "Roanoke", "Saginaw", "Southlake",
      "Watauga", "Weatherford", "White Settlement",
    ],
  },
  {
    market: "Houston",
    state: "TX",
    submarkets: ["North", "Northwest", "West", "Southwest", "South", "Southeast", "East"],
    cities: [
      "Houston", "Alvin", "Baytown", "Bellaire", "Brookshire", "Channelview", "Conroe", "Crosby", "Cypress",
      "Deer Park", "Fresno", "Friendswood", "Fulshear", "Galena Park", "Hockley", "Humble", "Jacinto City",
      "Jersey Village", "Katy", "Kingwood", "La Porte", "League City", "Manvel", "Missouri City", "Mont Belvieu",
      "Pasadena", "Pearland", "Porter", "Richmond", "Rosenberg", "Seabrook", "South Houston", "Spring", "Stafford",
      "Sugar Land", "The Woodlands", "Tomball", "Waller", "Webster",
    ],
  },
];
