import { resolveState } from "@/lib/usStates";

// Well-known US cities grouped by state CODE. This powers the city typeahead's
// suggestions only — it is NOT an exhaustive registry, and the CityField always
// allows free typing. Roughly the most-populous / best-known cities per state.
export const US_CITIES_BY_STATE: Record<string, string[]> = {
  AL: [
    "Birmingham", "Montgomery", "Huntsville", "Mobile", "Tuscaloosa", "Hoover",
    "Auburn", "Dothan", "Decatur", "Madison", "Florence", "Gadsden",
    "Vestavia Hills", "Prattville", "Phenix City", "Alabaster", "Opelika",
    "Enterprise", "Bessemer", "Homewood",
  ],
  AK: [
    "Anchorage", "Fairbanks", "Juneau", "Wasilla", "Sitka", "Ketchikan",
    "Kenai", "Kodiak", "Bethel", "Palmer", "Homer", "Soldotna", "Valdez",
    "Nome", "Barrow", "Seward",
  ],
  AZ: [
    "Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert",
    "Tempe", "Peoria", "Surprise", "Yuma", "Avondale", "Goodyear", "Flagstaff",
    "Buckeye", "Casa Grande", "Lake Havasu City", "Maricopa", "Sierra Vista",
    "Prescott", "Oro Valley", "Prescott Valley",
  ],
  AR: [
    "Little Rock", "Fayetteville", "Fort Smith", "Springdale", "Jonesboro",
    "Rogers", "Conway", "North Little Rock", "Bentonville", "Pine Bluff",
    "Hot Springs", "Benton", "Texarkana", "Sherwood", "Jacksonville",
    "Russellville", "Bella Vista", "West Memphis", "Paragould", "Cabot",
  ],
  CA: [
    "Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno",
    "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim",
    "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista", "Fremont",
    "San Bernardino", "Modesto", "Fontana", "Santa Clarita", "Oxnard",
    "Glendale", "Huntington Beach", "Ontario", "Rancho Cucamonga",
    "Santa Rosa", "Elk Grove", "Corona", "Lancaster", "Palmdale", "Salinas",
    "Pomona", "Hayward", "Escondido", "Sunnyvale", "Pasadena", "Torrance",
    "Orange", "Fullerton", "Berkeley", "Santa Monica", "Burbank", "Beverly Hills",
  ],
  CO: [
    "Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood",
    "Thornton", "Arvada", "Westminster", "Pueblo", "Centennial", "Boulder",
    "Greeley", "Longmont", "Loveland", "Broomfield", "Grand Junction",
    "Castle Rock", "Commerce City", "Parker", "Littleton", "Northglenn",
    "Brighton", "Englewood",
  ],
  CT: [
    "Bridgeport", "New Haven", "Stamford", "Hartford", "Waterbury", "Norwalk",
    "Danbury", "New Britain", "Bristol", "Meriden", "West Hartford", "Milford",
    "Middletown", "Norwich", "Shelton", "Torrington", "Greenwich", "Naugatuck",
    "Newington", "Stratford",
  ],
  DE: [
    "Wilmington", "Dover", "Newark", "Middletown", "Smyrna", "Milford",
    "Seaford", "Georgetown", "Elsmere", "New Castle", "Bear", "Brookside",
    "Hockessin", "Pike Creek", "Rehoboth Beach", "Lewes",
  ],
  DC: ["Washington"],
  FL: [
    "Jacksonville", "Miami", "Tampa", "Orlando", "St. Petersburg", "Hialeah",
    "Port St. Lucie", "Tallahassee", "Cape Coral", "Fort Lauderdale",
    "Pembroke Pines", "Hollywood", "Gainesville", "Miramar", "Coral Springs",
    "Lehigh Acres", "Palm Bay", "West Palm Beach", "Clearwater", "Brandon",
    "Spring Hill", "Pompano Beach", "Lakeland", "Davie", "Miami Gardens",
    "Boca Raton", "Sunrise", "Deltona", "Plantation", "Fort Myers",
    "Palm Coast", "Naples", "Kissimmee", "Sarasota", "Daytona Beach",
  ],
  GA: [
    "Atlanta", "Augusta", "Columbus", "Macon", "Savannah", "Athens",
    "Sandy Springs", "Roswell", "Johns Creek", "Warner Robins", "Albany",
    "Alpharetta", "Marietta", "Valdosta", "Smyrna", "Dunwoody", "Brookhaven",
    "Peachtree City", "Gainesville", "Newnan", "Milton", "Kennesaw",
    "Douglasville", "Lawrenceville", "Decatur",
  ],
  HI: [
    "Honolulu", "Hilo", "Kailua", "Kaneohe", "Waipahu", "Pearl City",
    "Kahului", "Mililani", "Kihei", "Ewa Beach", "Kapolei", "Wailuku",
    "Lahaina", "Waianae", "Kailua-Kona",
  ],
  ID: [
    "Boise", "Meridian", "Nampa", "Idaho Falls", "Caldwell", "Pocatello",
    "Coeur d'Alene", "Twin Falls", "Post Falls", "Lewiston", "Rexburg",
    "Eagle", "Moscow", "Kuna", "Ammon", "Chubbuck", "Hayden", "Garden City",
  ],
  IL: [
    "Chicago", "Aurora", "Joliet", "Naperville", "Rockford", "Springfield",
    "Elgin", "Peoria", "Champaign", "Waukegan", "Cicero", "Bloomington",
    "Arlington Heights", "Evanston", "Decatur", "Schaumburg", "Bolingbrook",
    "Palatine", "Skokie", "Des Plaines", "Orland Park", "Tinley Park", "Oak Lawn",
    "Berwyn", "Mount Prospect", "Normal", "Wheaton",
  ],
  IN: [
    "Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel",
    "Fishers", "Bloomington", "Hammond", "Gary", "Lafayette", "Muncie",
    "Terre Haute", "Kokomo", "Anderson", "Noblesville", "Greenwood",
    "Elkhart", "Mishawaka", "Lawrence", "Jeffersonville", "Columbus",
    "West Lafayette", "Portage",
  ],
  IA: [
    "Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City",
    "Waterloo", "Ames", "West Des Moines", "Council Bluffs", "Ankeny",
    "Dubuque", "Urbandale", "Cedar Falls", "Marion", "Bettendorf", "Mason City",
    "Marshalltown", "Clinton", "Burlington", "Ottumwa",
  ],
  KS: [
    "Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence",
    "Shawnee", "Manhattan", "Lenexa", "Salina", "Hutchinson", "Leavenworth",
    "Leawood", "Dodge City", "Garden City", "Junction City", "Emporia",
    "Derby", "Prairie Village", "Hays",
  ],
  KY: [
    "Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington",
    "Richmond", "Georgetown", "Florence", "Elizabethtown", "Hopkinsville",
    "Nicholasville", "Henderson", "Frankfort", "Jeffersontown", "Independence",
    "Paducah", "Radcliff", "Ashland", "Murray", "Madisonville",
  ],
  LA: [
    "New Orleans", "Baton Rouge", "Shreveport", "Metairie", "Lafayette",
    "Lake Charles", "Kenner", "Bossier City", "Monroe", "Alexandria",
    "Houma", "Marrero", "New Iberia", "Slidell", "Central", "Ruston",
    "Hammond", "Sulphur", "Natchitoches", "Gretna",
  ],
  ME: [
    "Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford",
    "Sanford", "Saco", "Augusta", "Westbrook", "Waterville", "Brunswick",
    "Scarborough", "Gorham", "Falmouth", "Orono",
  ],
  MD: [
    "Baltimore", "Columbia", "Germantown", "Silver Spring", "Waldorf",
    "Glen Burnie", "Ellicott City", "Frederick", "Dundalk", "Rockville",
    "Bethesda", "Gaithersburg", "Towson", "Bowie", "Aspen Hill", "Wheaton",
    "Bel Air", "Severn", "Annapolis", "Hagerstown", "Salisbury", "College Park",
  ],
  MA: [
    "Boston", "Worcester", "Springfield", "Cambridge", "Lowell", "Brockton",
    "Quincy", "Lynn", "New Bedford", "Fall River", "Newton", "Lawrence",
    "Somerville", "Framingham", "Haverhill", "Waltham", "Malden", "Brookline",
    "Plymouth", "Medford", "Taunton", "Chicopee", "Weymouth", "Revere", "Peabody",
  ],
  MI: [
    "Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor",
    "Lansing", "Flint", "Dearborn", "Livonia", "Troy", "Westland", "Farmington Hills",
    "Kalamazoo", "Wyoming", "Southfield", "Rochester Hills", "Taylor",
    "Saint Clair Shores", "Pontiac", "Royal Oak", "Novi", "Dearborn Heights",
    "Battle Creek", "Saginaw", "Midland",
  ],
  MN: [
    "Minneapolis", "Saint Paul", "Rochester", "Duluth", "Bloomington",
    "Brooklyn Park", "Plymouth", "Maple Grove", "Woodbury", "St. Cloud",
    "Eagan", "Eden Prairie", "Coon Rapids", "Burnsville", "Blaine",
    "Lakeville", "Minnetonka", "Apple Valley", "Edina", "St. Louis Park",
    "Mankato", "Moorhead", "Shakopee",
  ],
  MS: [
    "Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian",
    "Tupelo", "Olive Branch", "Greenville", "Horn Lake", "Pearl", "Madison",
    "Clinton", "Brandon", "Ridgeland", "Starkville", "Columbus", "Vicksburg",
    "Pascagoula", "Oxford",
  ],
  MO: [
    "Kansas City", "St. Louis", "Springfield", "Columbia", "Independence",
    "Lee's Summit", "O'Fallon", "St. Joseph", "St. Charles", "St. Peters",
    "Blue Springs", "Florissant", "Joplin", "Chesterfield", "Jefferson City",
    "Cape Girardeau", "Wildwood", "University City", "Ballwin", "Raytown",
  ],
  MT: [
    "Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena",
    "Kalispell", "Havre", "Anaconda", "Miles City", "Belgrade", "Livingston",
    "Laurel", "Whitefish", "Lewistown", "Sidney",
  ],
  NE: [
    "Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont",
    "Hastings", "Norfolk", "North Platte", "Columbus", "Papillion", "La Vista",
    "Scottsbluff", "South Sioux City", "Beatrice", "Lexington",
  ],
  NV: [
    "Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City",
    "Fernley", "Elko", "Mesquite", "Boulder City", "Fallon", "Winnemucca",
    "West Wendover", "Ely", "Yerington",
  ],
  NH: [
    "Manchester", "Nashua", "Concord", "Derry", "Dover", "Rochester", "Salem",
    "Merrimack", "Hudson", "Londonderry", "Keene", "Bedford", "Portsmouth",
    "Goffstown", "Laconia", "Hampton",
  ],
  NJ: [
    "Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Woodbridge",
    "Lakewood", "Toms River", "Hamilton", "Trenton", "Clifton", "Camden",
    "Brick", "Cherry Hill", "Passaic", "Union City", "Bayonne", "East Orange",
    "Vineland", "New Brunswick", "Hoboken", "Atlantic City", "Princeton",
  ],
  NM: [
    "Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell",
    "Farmington", "Clovis", "Hobbs", "Alamogordo", "Carlsbad", "Gallup",
    "Los Alamos", "Las Vegas", "Deming", "Sunland Park", "Artesia", "Silver City",
  ],
  NY: [
    "New York", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany",
    "New Rochelle", "Mount Vernon", "Schenectady", "Utica", "White Plains",
    "Hempstead", "Troy", "Niagara Falls", "Binghamton", "Freeport", "Valley Stream",
    "Long Beach", "Rome", "Ithaca", "Poughkeepsie", "Brooklyn", "Queens",
    "Bronx", "Staten Island", "Jamestown",
  ],
  NC: [
    "Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem",
    "Fayetteville", "Cary", "Wilmington", "High Point", "Concord", "Asheville",
    "Greenville", "Gastonia", "Jacksonville", "Chapel Hill", "Rocky Mount",
    "Huntersville", "Burlington", "Wilson", "Kannapolis", "Apex", "Hickory",
    "Wake Forest", "Indian Trail", "Mooresville",
  ],
  ND: [
    "Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Williston",
    "Dickinson", "Mandan", "Jamestown", "Wahpeton", "Devils Lake", "Valley City",
    "Grafton", "Beulah",
  ],
  OH: [
    "Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton",
    "Parma", "Canton", "Youngstown", "Lorain", "Hamilton", "Springfield",
    "Kettering", "Elyria", "Lakewood", "Cuyahoga Falls", "Middletown",
    "Euclid", "Newark", "Mansfield", "Mentor", "Beavercreek", "Strongsville",
    "Dublin", "Fairfield", "Findlay",
  ],
  OK: [
    "Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton", "Edmond",
    "Moore", "Midwest City", "Enid", "Stillwater", "Muskogee", "Bartlesville",
    "Owasso", "Shawnee", "Ponca City", "Ardmore", "Yukon", "Bixby", "Duncan",
    "Del City",
  ],
  OR: [
    "Portland", "Salem", "Eugene", "Gresham", "Hillsboro", "Beaverton",
    "Bend", "Medford", "Springfield", "Corvallis", "Albany", "Tigard",
    "Lake Oswego", "Keizer", "Grants Pass", "Oregon City", "McMinnville",
    "Redmond", "Tualatin", "West Linn", "Ashland",
  ],
  PA: [
    "Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton",
    "Bethlehem", "Lancaster", "Harrisburg", "York", "Wilkes-Barre", "Altoona",
    "Chester", "State College", "Bethel Park", "Norristown", "Williamsport",
    "Easton", "Levittown", "Drexel Hill", "King of Prussia", "Hazleton",
  ],
  RI: [
    "Providence", "Warwick", "Cranston", "Pawtucket", "East Providence",
    "Woonsocket", "Coventry", "Cumberland", "North Providence", "South Kingstown",
    "West Warwick", "Johnston", "North Kingstown", "Newport", "Bristol",
    "Westerly", "Smithfield",
  ],
  SC: [
    "Columbia", "Charleston", "North Charleston", "Mount Pleasant", "Rock Hill",
    "Greenville", "Summerville", "Sumter", "Goose Creek", "Hilton Head Island",
    "Florence", "Spartanburg", "Myrtle Beach", "Aiken", "Anderson", "Greer",
    "Mauldin", "Greenwood", "North Augusta", "Easley",
  ],
  SD: [
    "Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown",
    "Mitchell", "Yankton", "Pierre", "Huron", "Vermillion", "Spearfish",
    "Brandon", "Box Elder", "Madison", "Sturgis",
  ],
  TN: [
    "Nashville", "Memphis", "Knoxville", "Chattanooga", "Clarksville",
    "Murfreesboro", "Franklin", "Jackson", "Johnson City", "Bartlett",
    "Hendersonville", "Kingsport", "Collierville", "Cleveland", "Smyrna",
    "Germantown", "Brentwood", "Columbia", "Spring Hill", "La Vergne",
    "Gallatin", "Cookeville",
  ],
  TX: [
    "Houston", "San Antonio", "Dallas", "Austin", "Fort Worth", "El Paso",
    "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock", "Garland",
    "Irving", "Amarillo", "Grand Prairie", "Brownsville", "McKinney", "Frisco",
    "Pasadena", "Mesquite", "Killeen", "McAllen", "Carrollton", "Midland",
    "Waco", "Denton", "Abilene", "Odessa", "Beaumont", "Round Rock",
    "Richardson", "Pearland", "College Station", "Sugar Land", "The Woodlands",
    "Tyler", "Wichita Falls", "League City", "San Angelo", "Allen",
  ],
  UT: [
    "Salt Lake City", "West Valley City", "West Jordan", "Provo", "Orem",
    "Sandy", "Ogden", "St. George", "Layton", "South Jordan", "Lehi",
    "Millcreek", "Taylorsville", "Logan", "Murray", "Draper", "Bountiful",
    "Riverton", "Herriman", "Spanish Fork", "Pleasant Grove", "Roy",
  ],
  VT: [
    "Burlington", "South Burlington", "Rutland", "Essex Junction", "Barre",
    "Montpelier", "Winooski", "St. Albans", "Newport", "Vergennes", "Brattleboro",
    "Bennington", "Middlebury", "Stowe",
  ],
  VA: [
    "Virginia Beach", "Chesapeake", "Norfolk", "Arlington", "Richmond",
    "Newport News", "Alexandria", "Hampton", "Roanoke", "Portsmouth",
    "Suffolk", "Lynchburg", "Harrisonburg", "Leesburg", "Charlottesville",
    "Danville", "Blacksburg", "Manassas", "Petersburg", "Fredericksburg",
    "Winchester", "Salem", "Herndon", "Reston",
  ],
  WA: [
    "Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Kent", "Everett",
    "Renton", "Spokane Valley", "Federal Way", "Yakima", "Kirkland", "Bellingham",
    "Kennewick", "Auburn", "Pasco", "Marysville", "Lakewood", "Redmond",
    "Shoreline", "Richland", "Sammamish", "Olympia", "Lacey", "Burien",
  ],
  WV: [
    "Charleston", "Huntington", "Morgantown", "Parkersburg", "Wheeling",
    "Martinsburg", "Fairmont", "Beckley", "Clarksburg", "South Charleston",
    "Teays Valley", "St. Albans", "Vienna", "Bluefield", "Weirton", "Bridgeport",
  ],
  WI: [
    "Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton",
    "Waukesha", "Eau Claire", "Oshkosh", "Janesville", "West Allis",
    "La Crosse", "Sheboygan", "Wauwatosa", "Fond du Lac", "New Berlin",
    "Wausau", "Brookfield", "Beloit", "Greenfield", "Franklin", "Manitowoc",
  ],
  WY: [
    "Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan",
    "Green River", "Evanston", "Riverton", "Jackson", "Cody", "Rawlins",
    "Lander", "Torrington", "Powell", "Douglas",
  ],
};

// Suggestions for a state's city typeahead. Accepts either the 2-letter code
// (e.g. "CA") or the full state name (e.g. "California"); returns [] for an
// unknown / empty state so callers can fall back to free typing.
export function citiesForState(state: string): string[] {
  const resolved = resolveState(state);
  if (!resolved) return [];
  return US_CITIES_BY_STATE[resolved.code] ?? [];
}
