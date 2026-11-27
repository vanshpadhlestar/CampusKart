import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Home as HomeIcon,
  Package,
  ShoppingBag,
  User,
  Search,
  Plus,
  MessageCircle,
  MessagesSquare,
  HelpCircle,
  Shield,
  X,
  Check,
  ArrowLeft,
  MapPin,
  Send,
  Wallet,
  Star,
} from "lucide-react";
import LocationFields, { emptyLocation, resolveCollege, isLocationComplete } from "./LocationFields";

/* ---------------------------------------------------------------
   CampusKart — MVP
   Ink + paper + accent-blue + sage design system.
   No payment gateway: buyer and seller settle item payment directly
   between themselves (cash or UPI). The app just tracks listing
   status and lets people mark a deal complete once it's done.
   Data model:
     users:<mobile>        -> { mobile, upi, isAdmin, sold, bought }
     items:<id>            -> { id, sellerMobile, name, price, category,
                                 colour, state, district, college,
                                 description, photos:[dataURL...],
                                 status: active|reserved|sold, buyerMobile,
                                 chat: [{from, text, ts}], createdAt }
     item-index            -> [id, id, ...]   (shared)
     session               -> { mobile }      (personal, this device)
------------------------------------------------------------------*/

const COLLEGES = [
  "YMCA University of Science & Technology, Faridabad",
  "IIT Delhi",
  "IIT Bombay",
  "IIT Kanpur",
  "IIT Madras",
  "IIT Kharagpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT BHU Varanasi",
  "NIT Kurukshetra",
  "NIT Trichy",
  "NIT Warangal",
  "Delhi University",
  "Jamia Millia Islamia",
  "Jawaharlal Nehru University",
  "BITS Pilani",
  "VIT Vellore",
  "Anna University",
  "Manipal Institute of Technology",
  "SRM Institute of Science and Technology",
  "Amity University",
  "Lovely Professional University",
  "Christ University",
  "Symbiosis International University",
  "Jadavpur University",
  "Panjab University",
  "Guru Gobind Singh Indraprastha University",
  "Maharshi Dayanand University, Rohtak",
  "Kurukshetra University",
  "Chandigarh University",
  "Thapar Institute of Engineering & Technology",
  "PEC Chandigarh",
  "Netaji Subhas University of Technology, Delhi",
  "Delhi Technological University",
  "Punjab Engineering College",
  "Banaras Hindu University",
  "University of Mumbai",
  "Savitribai Phule Pune University",
  "College of Engineering Pune",
  "Osmania University",
  "Andhra University",
  "University of Hyderabad",
  "Bangalore University",
  "PES University",
  "RV College of Engineering",
  "University of Calcutta",
  "University of Rajasthan",
  "Malaviya National Institute of Technology, Jaipur",
  "Aligarh Muslim University",
  "Allahabad University",
  "Gujarat Technological University",
  "Nirma University",
  "Sardar Patel University",
];

const CATEGORIES = [
  "Books & Notes",
  "Electronics",
  "Dresses & Clothing",
  "Cycle",
  "Hostel Essentials",
  "Stationery",
  "Sports Gear",
  "Others",
];

const ADMIN_MOBILE = "9999999999";

// Replace with the UPI ID that should receive optional "support this project"
// contributions. There's no per-transaction fee anywhere in the app — buyers
// and sellers settle item payments directly between themselves (cash or UPI).
const SUPPORT_UPI_ID = "9354002982@upi";
const SUPPORT_UPI_NAME = "Vansh Pabreja";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------------------------------------------------------
   Supabase — real persistence. Shared data (users, items, reports,
   feedback, college item presets) lives in Postgres via Supabase's
   REST API (no SDK needed, just fetch — keeps this a single file).
   Only "session" (which mobile is logged in on THIS device) stays
   local, via localStorage, since that's inherently per-device.
------------------------------------------------------------------*/
const SUPABASE_URL = "https://wztzizatgbytjgholjke.supabase.co";
const SUPABASE_KEY = "sb_publishable_Qr2yVY_hSedUmqEz-h9YlA_7FqBNn_T";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const toSnakeKey = (k) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const toCamelKey = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function toSnakeObj(obj) {
  const out = {};
  for (const k in obj) out[toSnakeKey(k)] = obj[k];
  return out;
}
function toCamelObj(obj) {
  if (!obj) return obj;
  const out = {};
  for (const k in obj) out[toCamelKey(k)] = obj[k];
  return out;
}

// Maps this app's old key-value key patterns onto real Supabase tables,
// so the many existing storageGet/storageSet call sites didn't all need
// rewriting by hand.
function parseStorageKey(key) {
  if (key === "session") return { special: "session" };
  if (key === "item-index") return { special: "noop-index" };
  if (key === "report-index") return { special: "noop-index" };
  if (key === "feedback-index") return { special: "noop-index" };
  const i = key.indexOf(":");
  if (i === -1) return null;
  const prefix = key.slice(0, i);
  const id = key.slice(i + 1);
  if (prefix === "users") return { table: "users", pk: "mobile", id };
  if (prefix === "items") return { table: "items", pk: "id", id };
  if (prefix === "reports") return { table: "reports", pk: "id", id };
  if (prefix === "feedback") return { table: "feedback", pk: "id", id };
  if (prefix === "default-items") return { special: "default-items", college: id };
  return null;
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // sandboxed/private-browsing contexts may block localStorage — session
    // just won't persist across a refresh there, which is an acceptable
    // fallback rather than a hard failure.
  }
}

async function storageGet(key, shared) {
  try {
    if (!shared) return readLocal(key);

    const parsed = parseStorageKey(key);
    if (!parsed) return null;

    if (parsed.special === "session") return readLocal(key);
    if (parsed.special === "noop-index") return []; // callers that still ask for an index get an empty list; real reads happen in bulk elsewhere
    if (parsed.special === "default-items") {
      const rows = await sbFetch(`default_items?college=eq.${encodeURIComponent(parsed.college)}&select=*`);
      return (rows || []).map((r) => ({ name: r.name, category: r.category, colours: r.colours || [] }));
    }
    if (parsed.table) {
      const rows = await sbFetch(`${parsed.table}?${parsed.pk}=eq.${encodeURIComponent(parsed.id)}&select=*`);
      if (!rows || rows.length === 0) return null;
      return toCamelObj(rows[0]);
    }
    return null;
  } catch (e) {
    console.error("storageGet failed", key, e);
    return null;
  }
}

async function storageSet(key, value, shared) {
  try {
    if (!shared) {
      writeLocal(key, value);
      return;
    }

    const parsed = parseStorageKey(key);
    if (!parsed) return;

    if (parsed.special === "noop-index") return; // table rows are the source of truth now
    if (parsed.special === "default-items") {
      // Full-array replace, matching how CommonItemsPanel builds a whole
      // new array locally then saves it.
      await sbFetch(`default_items?college=eq.${encodeURIComponent(parsed.college)}`, { method: "DELETE" });
      if (value && value.length) {
        const rows = value.map((v) => ({ college: parsed.college, name: v.name, category: v.category, colours: v.colours || [] }));
        await sbFetch("default_items", { method: "POST", body: JSON.stringify(rows) });
      }
      return;
    }
    if (parsed.table) {
      const row = { ...toSnakeObj(value), [parsed.pk]: parsed.id };
      await sbFetch(parsed.table, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(row),
      });
    }
  } catch (e) {
    console.error("storageSet failed", key, e);
  }
}

// Bulk fetch — used for hot paths (initial load, admin lists) where the
// old get-index-then-get-each-row pattern would mean N+1 network calls.
async function sbFetchAll(table) {
  try {
    const rows = await sbFetch(`${table}?select=*`);
    return (rows || []).map(toCamelObj);
  } catch (e) {
    console.error("sbFetchAll failed", table, e);
    return [];
  }
}

const DEMO_MOBILES = [
  "9812300001","9812300002","9812300003","9812300004","9812300005",
  "9812300006","9812300007","9812300008","9812300009","9812300010",
  "9812300011","9812300012","9812300013","9812300014","9812300015",
  "9812300016","9812300017","9812300018","9812300019","9812300020",
];

const YMCA = "YMCA University of Science & Technology, Faridabad";

function demoItemSeed() {
  const base = [
    { name: "Engineering Graphics Drafting Kit", price: 350, category: "Stationery", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Full drafting kit used for one semester of Engineering Graphics — mini drafter, set squares, compass box, all in working condition. Great for first-years just starting EG." },
    { name: "Data Structures Textbook", price: 250, category: "Books & Notes", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Standard Data Structures textbook used in 2nd year CSE/IT, minimal highlighting, all pages intact. Comes with handwritten unit-wise notes for quick revision before exams." },
    { name: "Casio fx-991ES Scientific Calculator", price: 500, category: "Electronics", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Casio fx-991ES Plus, used through first year for maths and physics labs. All functions working, comes with original cover. Battery replaced recently." },
    { name: "Hostel Study Lamp", price: 300, category: "Hostel Essentials", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Adjustable-neck LED study lamp, perfect for hostel desks. Bright white light, low power consumption, no flicker. Selling since I'm shifting to a PG with fixed lighting." },
    { name: "Hero Sprint Cycle", price: 2200, category: "Cycle", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Used Hero cycle, single owner, good tyres and brakes, serviced last month. Great for getting around campus and to the market quickly. Minor scratches, nothing major." },
    { name: "Lab Coat + Safety Goggles Set", price: 200, category: "Hostel Essentials", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Lab coat (size M) and safety goggles used for chemistry and physics practicals in first year. Clean, no stains, goggles have no scratches on the lens." },
    { name: "Formal Shirt & Trousers Set", price: 600, category: "Dresses & Clothing", colour: "White", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Worn twice for placement pre-interviews. Size M shirt, 32 trousers. Good quality fabric, dry-cleaned and ready to wear for interviews or seminars." },
    { name: "Physics Practical File + Lab Manual", price: 150, category: "Books & Notes", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Complete first-year physics practical file with all experiments recorded, plus the lab manual. Useful reference for anyone repeating the practicals or wanting sample write-ups." },
    { name: "Mini Fridge (Hostel Room)", price: 3500, category: "Hostel Essentials", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Compact mini fridge used in hostel room for 2 years, cooling perfectly, no issues. Ideal for storing snacks, milk, and leftovers. Selling as I'm moving to a flat with a full fridge." },
    { name: "Drawing Board with Clamps", price: 400, category: "Stationery", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "A2-size drawing board with clamps, used for Engineering Graphics and a couple of architecture electives. Flat surface, no warping, includes a T-square." },
    { name: "USB Desk Lamp", price: 280, category: "Hostel Essentials", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Compact USB-powered desk lamp, runs off a power bank or laptop too. Great for hostel rooms with limited sockets. Barely used, like new." },
    { name: "Acoustic Guitar (Used)", price: 3200, category: "Others", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Full-size acoustic guitar, a few small dents on the body but sounds great. Comes with a spare set of strings and a soft gig bag." },
    { name: "Chemistry Practical Kit", price: 300, category: "Others", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Complete first-year chemistry practical kit — test tubes, burette, pipette, stand and more. All glassware intact, no cracks." },
    { name: "Bluetooth Speaker", price: 700, category: "Electronics", college: "Delhi Technological University", state: "Delhi", district: "New Delhi",
      description: "Portable Bluetooth speaker, good bass, battery lasts about 6 hours. Used for a semester in the hostel room, works perfectly." },
    { name: "Badminton Racket Set (2 rackets)", price: 450, category: "Sports Gear", college: "Maharshi Dayanand University, Rohtak", state: "Haryana", district: "Rohtak",
      description: "Two badminton rackets with a few shuttlecocks, decent condition strings. Great for casual evening games on campus courts." },
    { name: "Formal Blazer (Placement Season)", price: 800, category: "Dresses & Clothing", colour: "Navy Blue", college: "Kurukshetra University", state: "Haryana", district: "Kurukshetra",
      description: "Navy blue formal blazer, size 40, worn for placement interviews only. Dry cleaned and stored well, no wear marks." },
    { name: "Laptop Stand (Aluminium)", price: 350, category: "Electronics", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Foldable aluminium laptop stand, adjustable height, helps with posture during long study sessions. Light scratches on the base only." },
    { name: "Engineering Chemistry Textbook", price: 200, category: "Books & Notes", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "First-year Engineering Chemistry textbook with solved numericals marked. Cover slightly worn but all pages clean and readable." },
    { name: "Clothes Iron (Press)", price: 450, category: "Hostel Essentials", college: "Panjab University", state: "Chandigarh", district: "Chandigarh",
      description: "Compact clothes iron, works fine, auto shut-off feature intact. Useful for hostel or PG rooms, selling as I'm moving abroad for further studies." },
    { name: "Wall Clock", price: 150, category: "Hostel Essentials", college: YMCA, state: "Haryana", district: "Faridabad",
      description: "Simple battery-operated wall clock, silent movement, no ticking noise at night. Perfect for a hostel room or study table wall." },
  ];
  return base.map((b, i) => ({
    id: `demo-${i + 1}`,
    sellerMobile: DEMO_MOBILES[i],
    name: b.name,
    price: b.price,
    category: b.category,
    colour: b.colour || "",
    state: b.state,
    district: b.district,
    college: b.college,
    description: b.description,
    photos: [],
    status: "active",
    blocked: false,
    buyerMobile: null,
    chat: [],
    createdAt: Date.now() - (20 - i) * 3600 * 1000,
  }));
}

function computeAvgRating(sellerUser) {
  if (!sellerUser || !sellerUser.ratings || sellerUser.ratings.length === 0) return null;
  const sum = sellerUser.ratings.reduce((s, r) => s + r.stars, 0);
  return (sum / sellerUser.ratings.length).toFixed(1);
}

function computeAvgReplyTime(sellerMobile, allItems) {
  const deltas = [];
  allItems
    .filter((it) => it.sellerMobile === sellerMobile && it.chat && it.chat.length > 1)
    .forEach((it) => {
      const chat = it.chat;
      for (let i = 1; i < chat.length; i++) {
        if (chat[i].from === sellerMobile && chat[i - 1].from !== sellerMobile) {
          deltas.push(chat[i].ts - chat[i - 1].ts);
        }
      }
    });
  if (deltas.length === 0) return null;
  const avgMs = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  const mins = avgMs / 60000;
  if (mins < 60) return `~${Math.max(1, Math.round(mins))} min`;
  return `~${Math.round(mins / 60)} hr`;
}

/* ---- light-weight item helpers: no photos, so they are small and fast ---- */
const ITEM_LIGHT_COLS =
  "id,seller_mobile,buyer_mobile,name,price,category,colour,state,district,college,description,status,chat,exchange_confirmed,blocked,created_at";

async function fetchItemsLight() {
  const rows = await sbFetch(`items?select=${ITEM_LIGHT_COLS}`);
  return (rows || []).map(toCamelObj);
}

async function fetchItemLive(id) {
  try {
    const rows = await sbFetch(`items?id=eq.${encodeURIComponent(id)}&select=${ITEM_LIGHT_COLS}`);
    return rows && rows[0] ? toCamelObj(rows[0]) : null;
  } catch (e) {
    console.error("fetchItemLive failed", e);
    return null;
  }
}

// Save only the given fields of one item (so photos are not re-uploaded each time)
async function patchItemFields(id, fields) {
  await sbFetch(`items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(toSnakeObj(fields)),
  });
}

async function deleteItemRow(id) {
  await sbFetch(`items?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

const STATUS_RANK = { active: 0, reserved: 1, sold: 2 };
function mergeChats(a = [], b = []) {
  const seen = new Set();
  const out = [];
  [...a, ...b].forEach((m) => {
    const k = `${m.from}|${m.ts}|${m.text}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(m);
    }
  });
  return out.sort((x, y) => x.ts - y.ts);
}
// a = what this device has, b = fresher data from the database
function mergeItem(a, b) {
  if (!b) return a;
  const status = (STATUS_RANK[a.status] || 0) > (STATUS_RANK[b.status] || 0) ? a.status : b.status;
  return {
    ...a,
    ...b,
    photos: b.photos !== undefined ? b.photos : a.photos,
    status,
    chat: mergeChats(a.chat, b.chat),
    exchangeConfirmed: { ...(b.exchangeConfirmed || {}), ...(a.exchangeConfirmed || {}) },
    buyerMobile: b.buyerMobile || a.buyerMobile || null,
  };
}
const lightSig = (i) =>
  JSON.stringify([i.name, i.price, i.category, i.colour, i.description, i.status, i.buyerMobile, i.blocked, i.chat, i.exchangeConfirmed]);

// Shrink a phone photo before saving (keeps the app fast)
function resizeImage(file, maxSide = 800, quality = 0.72) {
  return new Promise((resolve) => {
    const fallback = () => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    };
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        fallback();
      };
      img.src = url;
    } catch (e) {
      fallback();
    }
  });
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------------- Shell / App ---------------- */

function useFonts() {
  useEffect(() => {
    if (document.getElementById("campuskart-fonts")) return;
    const link = document.createElement("link");
    link.id = "campuskart-fonts";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Work+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    const st = document.createElement("style");
    st.id = "campuskart-base-css";
    st.textContent =
      "html,body,#root{height:100%;margin:0;background:#06080F;}" +
      "body{-webkit-text-size-adjust:100%;overscroll-behavior:none;}" +
      "input,select,textarea{font-size:16px !important;}" +
      "img{max-width:100%;}" +
      "*{-webkit-tap-highlight-color:transparent;}";
    document.head.appendChild(st);
  }, []);
}

export default function CampusKart() {
  useFonts();
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null); // {mobile}
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("home");
  const [view, setView] = useState({ name: "list" }); // routing within tabs
  const [toast, setToast] = useState(null);
  const [showSupport, setShowSupport] = useState(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const itemsRef = useRef([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Adds the demo listings only if some are missing. One quick check, then one bulk save.
  const seedIfEmpty = useCallback(async () => {
    try {
      const have = await sbFetch("items?select=id&id=like.demo-*");
      const haveIds = new Set((have || []).map((r) => r.id));
      const missing = demoItemSeed().filter((it) => !haveIds.has(it.id));
      if (missing.length === 0) return false;
      await sbFetch("items", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(missing.map(toSnakeObj)),
      });
      return true;
    } catch (e) {
      console.error("seed failed", e);
      return false;
    }
  }, []);

  const loadItems = useCallback(async () => {
    const loaded = await sbFetchAll("items");
    loaded.sort((a, b) => b.createdAt - a.createdAt);
    setItems(loaded);
  }, []);

  useEffect(() => {
    (async () => {
      const s = await storageGet("session", false);
      if (s && s.mobile) {
        const u = await storageGet(`users:${s.mobile}`, true);
        if (u) {
          setSession(s);
          setUser(u);
        }
      }
      // show the app quickly using the small (no photo) list, then fill in photos
      try {
        const light = await fetchItemsLight();
        light.sort((a, b) => b.createdAt - a.createdAt);
        setItems(light);
      } catch (e) {
        console.error(e);
      }
      setBooting(false);
      const seeded = await seedIfEmpty();
      await loadItems();
      if (seeded) console.log("demo items added");
    })();
  }, [loadItems, seedIfEmpty]);

  // Live updates: every few seconds check for new messages, reservations, new items.
  useEffect(() => {
    if (!user) return undefined;
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const light = await fetchItemsLight();
        if (stop || !light) return;
        const cur = itemsRef.current;
        const map = new Map(cur.map((i) => [i.id, i]));
        if (light.some((l) => !map.has(l.id))) {
          await loadItems();
          return;
        }
        const lightMap = new Map(light.map((l) => [l.id, l]));
        let changed = cur.some((i) => !lightMap.has(i.id));
        if (!changed) changed = light.some((l) => lightSig(map.get(l.id)) !== lightSig(l));
        if (changed) {
          setItems((prev) => prev.filter((i) => lightMap.has(i.id)).map((i) => mergeItem(i, lightMap.get(i.id))));
        }
      } catch (e) {
        console.error("poll failed", e);
      } finally {
        busy = false;
      }
    };
    const id = setInterval(tick, 4000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [user, loadItems]);

  const persistUser = useCallback(async (u) => {
    setUser(u);
    await storageSet(`users:${u.mobile}`, u, true);
  }, []);

  // persistItem(item)            -> save the whole item (new item, or edit with photos)
  // persistItem(item, {fields})  -> save only those fields (chat, status, block ...)
  const persistItem = useCallback(async (it, fields) => {
    setItems((prev) => {
      const exists = prev.some((x) => x.id === it.id);
      return exists ? prev.map((x) => (x.id === it.id ? { ...x, ...it } : x)) : [it, ...prev];
    });
    try {
      if (fields) await patchItemFields(it.id, fields);
      else await storageSet(`items:${it.id}`, it, true);
    } catch (e) {
      console.error("persistItem failed", e);
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await deleteItemRow(id);
    } catch (e) {
      console.error("delete failed", e);
    }
  }, []);

  const promoteToAdmin = useCallback(async (mobile) => {
    const u = await storageGet(`users:${mobile}`, true);
    if (!u) {
      showToast("No user found with that mobile number yet.");
      return;
    }
    u.isAdmin = true;
    await storageSet(`users:${mobile}`, u, true);
    showToast(`${mobile} is now an admin.`);
  }, [showToast]);

  const submitReport = useCallback(async (report) => {
    const id = uid();
    const full = { ...report, id, ts: Date.now() };
    await storageSet(`reports:${id}`, full, true);
    showToast("Report submitted. Admin will review it.");
  }, [showToast]);

  const submitFeedback = useCallback(async (mobile, text) => {
    const id = uid();
    const full = { id, mobile, text, ts: Date.now() };
    await storageSet(`feedback:${id}`, full, true);
  }, []);

  const addItemToIndex = useCallback(async (id) => {
    const index = (await storageGet("item-index", true)) || [];
    if (!index.includes(id)) {
      index.unshift(id);
      await storageSet("item-index", index, true);
    }
  }, []);

  async function handleLogin(mobile, upi, profile) {
    let u = await storageGet(`users:${mobile}`, true);
    if (!u) {
      u = {
        mobile,
        fullName: profile.fullName,
        upi: upi || "",
        isAdmin: mobile === ADMIN_MOBILE,
        sold: 0,
        bought: 0,
        blocked: false,
        ratings: [],
        state: profile.state,
        district: profile.district,
        college: profile.college,
      };
      await storageSet(`users:${mobile}`, u, true);
    }
    await storageSet("session", { mobile }, false);
    setSession({ mobile });
    setUser(u);
  }

  async function handleLogout() {
    await storageSet("session", null, false);
    setSession(null);
    setUser(null);
  }

  if (booting) {
    return (
      <div style={S.bootWrap}>
        <div style={S.bootMark}>CampusKart</div>
      </div>
    );
  }

  if (!session || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div style={S.appShell}>
      <TopBar user={user} onLogout={handleLogout} onSupport={() => setShowSupport(true)} />
      <div style={S.screen}>
        {tab === "home" && (
          <HomeTab
            user={user}
            items={items}
            view={view}
            setView={setView}
            addItemToIndex={addItemToIndex}
            persistItem={persistItem}
            persistUser={persistUser}
            showToast={showToast}
            submitReport={submitReport}
          />
        )}
        {tab === "my-items" && (
          <MyItemsTab
            user={user}
            items={items.filter((i) => i.sellerMobile === user.mobile)}
            allItems={items}
            view={view}
            setView={setView}
            persistItem={persistItem}
            persistUser={persistUser}
            showToast={showToast}
            submitReport={submitReport}
          />
        )}
        {tab === "chats" && (
          <ChatsTab
            user={user}
            items={items}
            view={view}
            setView={setView}
            persistItem={persistItem}
            persistUser={persistUser}
            showToast={showToast}
            submitReport={submitReport}
          />
        )}
        {tab === "bought" && (
          <BoughtTab
            user={user}
            items={items.filter((i) => i.buyerMobile === user.mobile)}
            persistItem={persistItem}
            persistUser={persistUser}
            showToast={showToast}
          />
        )}
        {tab === "account" && (
          <AccountTab
            user={user}
            persistUser={persistUser}
            items={items}
            persistItem={persistItem}
            deleteItem={deleteItem}
            promoteToAdmin={promoteToAdmin}
            showToast={showToast}
            onLogout={handleLogout}
          />
        )}
      </div>
      <TabBar tab={tab} setTab={(t) => { setTab(t); setView({ name: "list" }); }} />
      {showSupport && (
        <SupportModal
          user={user}
          onSubmit={submitFeedback}
          onClose={() => setShowSupport(false)}
          showToast={showToast}
        />
      )}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

/* ---------------- Login ---------------- */

function LoginScreen({ onLogin }) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [upi, setUpi] = useState("");
  const [loc, setLoc] = useState(emptyLocation);
  const [error, setError] = useState("");

  function continueToApp() {
    if (!fullName.trim()) {
      setError("Enter your full name");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (!isLocationComplete(loc)) {
      setError("Select your state, district and college");
      return;
    }
    setError("");
    onLogin(mobile, upi, {
      fullName: fullName.trim(),
      state: loc.state,
      district: loc.district,
      college: resolveCollege(loc),
    });
  }

  return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <div style={S.brand}>CampusKart</div>
        <div style={S.brandSub}>Pass it on to next year's batch.</div>

        <label style={S.label}>Full name</label>
        <input
          style={S.input}
          placeholder="Your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <label style={S.label}>Mobile number</label>
        <input
          style={S.input}
          placeholder="98765 43210"
          value={mobile}
          maxLength={10}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
        />
        <label style={S.label}>UPI ID (optional)</label>
        <input
          style={S.input}
          placeholder="yourname@upi"
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
        />
        <LocationFields
          value={loc}
          onChange={setLoc}
          colleges={COLLEGES}
          inputStyle={S.input}
          labelStyle={S.label}
        />
        {error && <div style={S.error}>{error}</div>}
        <button style={S.primaryBtn} onClick={continueToApp}>
          Continue
        </button>
      </div>
    </div>
  );
}

/* ---------------- Top bar / Tab bar ---------------- */

function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size * 0.77} viewBox="0 0 44 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 6 A11 11 0 1 0 17 28" stroke={COLORS.accent} strokeWidth="4" strokeLinecap="round" fill="none" />
      <line x1="24" y1="4" x2="24" y2="24" stroke={COLORS.accent} strokeWidth="4" strokeLinecap="round" />
      <line x1="24" y1="15" x2="39" y2="4" stroke={COLORS.accent} strokeWidth="4" strokeLinecap="round" />
      <line x1="24" y1="15" x2="39" y2="23" stroke={COLORS.accent} strokeWidth="4" strokeLinecap="round" />
      <circle cx="30" cy="30" r="2.6" fill={COLORS.accent} />
      <circle cx="37" cy="30" r="2.6" fill={COLORS.accent} />
    </svg>
  );
}

function TopBar({ user, onLogout, onSupport }) {
  return (
    <div style={S.topBar}>
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user.isAdmin && (
          <div style={S.adminPill}>
            <Shield size={12} /> Admin
          </div>
        )}
        <button style={S.supportIconBtn} onClick={onSupport} title="Help & feedback">
          <HelpCircle size={19} />
        </button>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { key: "home", label: "Home", icon: HomeIcon },
    { key: "my-items", label: "My Items", icon: Package },
    { key: "chats", label: "Chats", icon: MessagesSquare },
    { key: "bought", label: "Bought", icon: ShoppingBag },
    { key: "account", label: "Account", icon: User },
  ];
  return (
    <div style={S.tabBar}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...S.tabBtn,
              color: active ? COLORS.ink : "#7C86A0",
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
            <span style={{ fontSize: 11, marginTop: 3 }}>{t.label}</span>
            {active && <div style={S.tabDot} />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Home tab (browse / search / add / detail) ---------------- */


function HomeTab({ user, items, view, setView, addItemToIndex, persistItem, persistUser, showToast, submitReport }) {
  if (view.name === "add") {
    return (
      <AddItemForm
        user={user}
        onCancel={() => setView({ name: "list" })}
        onSaved={async (item) => {
          await persistItem(item);
          await addItemToIndex(item.id);
          setView({ name: "list" });
          showToast("Listed! It's now visible to everyone.");
        }}
      />
    );
  }

  if (view.name === "browse") {
    return (
      <BrowseScreen
        user={user}
        items={items}
        onBack={() => setView({ name: "list" })}
        onOpenItem={(item) => setView({ name: "detail", id: item.id, item })}
      />
    );
  }

  if (view.name === "detail") {
    const item = items.find((i) => i.id === view.id) || view.item;
    return (
      <ItemDetail
        item={item}
        user={user}
        allItems={items}
        onBack={() => setView({ name: "list" })}
        persistItem={persistItem}
        persistUser={persistUser}
        showToast={showToast}
        submitReport={submitReport}
      />
    );
  }

  const liveCount = items.filter((i) => i.status === "active").length;
  const collegeCount = new Set(items.map((i) => i.college)).size;
  const totalValue = items
    .filter((i) => i.status === "active")
    .reduce((sum, i) => sum + i.price, 0);
  const totalValueLabel =
    totalValue >= 1000 ? `₹${(totalValue / 1000).toFixed(1)}k` : `₹${totalValue}`;

  return (
    <div>
      <div style={S.promoBanner}>
        <div style={S.promoBannerAccent} />
        <div style={S.promoBannerKicker}>CampusKart</div>
        <div style={S.promoBannerTitle}>Someone needs what you don't.</div>
        <div style={S.promoStatsRow}>
          <div style={S.promoStat}>
            <div style={S.promoStatNum}>{liveCount}</div>
            <div style={S.promoStatLabel}>items live</div>
          </div>
          <div style={S.promoStat}>
            <div style={S.promoStatNum}>{collegeCount}</div>
            <div style={S.promoStatLabel}>colleges</div>
          </div>
          <div style={S.promoStat}>
            <div style={S.promoStatNum}>{totalValueLabel}</div>
            <div style={S.promoStatLabel}>up for grabs</div>
          </div>
        </div>
      </div>

      <div style={S.rowGap}>
        <button style={S.ctaBtn} onClick={() => setView({ name: "add" })}>
          <Plus size={16} /> Add item
        </button>
        <button style={S.ghostBtn} onClick={() => setView({ name: "browse" })}>
          <Search size={16} /> Browse items
        </button>
      </div>

      <div style={S.emptyState}>
        Tap "Browse items" to see what's listed near you.
      </div>
    </div>
  );
}

/* ---------------- Browse screen (scope, then name search, then results) ---------------- */

function BrowseScreen({ user, items, onBack, onOpenItem }) {
  const [query, setQuery] = useState("");

  const visible = items.filter(
    (i) =>
      i.sellerMobile !== user.mobile &&
      i.status !== "sold" &&
      (!i.blocked || user.isAdmin) &&
      (!query || i.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div>
      <ScreenHeader title="Browse" onBack={onBack} />
      <input
        style={S.input}
        placeholder="Search by item name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div style={{ marginTop: 4 }}>
        {visible.length === 0 && (
          <div style={S.emptyState}>
            {query ? "No items match your search." : "Nothing listed yet."}
          </div>
        )}
        {visible.map((item) => (
          <ItemCard key={item.id} item={item} onClick={() => onOpenItem(item)} />
        ))}
      </div>
    </div>
  );
}

function scoreSeller(item) {
  return item._sellerScore || 0;
}

function ItemCard({ item, onClick }) {
  return (
    <div style={S.itemCard} onClick={onClick}>
      <div style={S.itemCardPhoto}>
        {item.photos && item.photos[0] ? (
          <img src={item.photos[0]} alt={item.name} style={S.itemCardImg} />
        ) : (
          <div style={S.itemCardPlaceholder}>{item.category[0]}</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.itemCardName}>{item.name}</div>
        <div style={S.itemCardMeta}>
          <MapPin size={11} style={{ marginRight: 3 }} />
          {item.college}
        </div>
        {item.status === "reserved" && (
          <div style={S.escrowBadge}>Reserved — deal in progress</div>
        )}
        {item.status === "sold" && <div style={S.soldBadge}>Sold</div>}
        {item.blocked && <div style={S.soldBadge}>Blocked by admin</div>}
      </div>
      <div style={S.priceTag}>₹{item.price}</div>
    </div>
  );
}

/* ---------------- Add item form ---------------- */

function AddItemForm({ user, onCancel, onSaved, initial }) {
  const isEdit = !!initial;
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial ? initial.name : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [category, setCategory] = useState(initial ? initial.category : CATEGORIES[0]);
  const [colour, setColour] = useState(initial ? initial.colour || "" : "");
  const [description, setDescription] = useState(initial ? initial.description || "" : "");
  const [photos, setPhotos] = useState(initial ? initial.photos || [] : []);
  const [error, setError] = useState("");
  const [presets, setPresets] = useState([]);
  const [presetPick, setPresetPick] = useState("");

  useEffect(() => {
    (async () => {
      const list = (await storageGet(`default-items:${user.college}`, true)) || [];
      setPresets(list);
    })();
  }, [user.college]);

  function applyPreset(idx) {
    setPresetPick(idx);
    if (idx === "") return;
    const p = presets[Number(idx)];
    if (!p) return;
    setName(p.name);
    setCategory(p.category);
    setColour(p.colours && p.colours[0] ? p.colours[0] : "");
  }

  async function handlePhoto(e, index) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    if (!dataUrl) return;
    setPhotos((p) => {
      const next = [...p];
      next[index] = dataUrl;
      return next;
    });
  }

  async function submit() {
    if (savingRef.current) return; // ignore a second tap while saving
    if (!name.trim() || !price) {
      setError("Fill in item name and price.");
      return;
    }
    if (description.split(/\s+/).filter(Boolean).length > 100) {
      setError("Description should be about 100 words or less.");
      return;
    }
    setError("");
    const fields = {
      name: name.trim(),
      price: Number(price),
      category,
      colour: category === "Dresses & Clothing" ? colour : "",
      description: description.trim(),
      photos: photos.filter(Boolean),
    };
    const item = isEdit
      ? { ...initial, ...fields }
      : {
          id: uid(),
          sellerMobile: user.mobile,
          ...fields,
          state: user.state,
          district: user.district,
          college: user.college,
          status: "active",
          blocked: false,
          buyerMobile: null,
          chat: [],
          exchangeConfirmed: {},
          createdAt: Date.now(),
        };
    savingRef.current = true;
    setSaving(true);
    try {
      await onSaved(item);
    } catch (e) {
      console.error(e);
      setError("Could not save. Please try again.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  const activePreset = presetPick !== "" ? presets[Number(presetPick)] : null;

  return (
    <div>
      <ScreenHeader title={isEdit ? "Edit item" : "Add item"} onBack={onCancel} />
      <div style={S.formPhotoRow}>
        {[0, 1].map((i) => (
          <label key={i} style={S.photoSlot}>
            {photos[i] ? (
              <img src={photos[i]} alt="" style={S.photoPreview} />
            ) : (
              <span style={{ fontSize: 22, color: "#6B7690" }}>+</span>
            )}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handlePhoto(e, i)}
            />
          </label>
        ))}
      </div>

      {presets.length > 0 && (
        <FormField label={`Common items for ${user.college}`}>
          <select style={S.input} value={presetPick} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">Type my own item instead</option>
            {presets.map((p, i) => (
              <option key={i} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      <FormField label="Item name">
        <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Price (₹)">
        <input
          style={S.input}
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </FormField>
      <FormField label="Category">
        <select style={S.input} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FormField>
      {(category === "Dresses & Clothing" || (activePreset && activePreset.colours && activePreset.colours.length > 0)) && (
        <FormField label="Colour">
          {activePreset && activePreset.colours && activePreset.colours.length > 0 ? (
            <select style={S.input} value={colour} onChange={(e) => setColour(e.target.value)}>
              {activePreset.colours.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input style={S.input} value={colour} onChange={(e) => setColour(e.target.value)} />
          )}
        </FormField>
      )}
      <FormField label="Description (~100 words)">
        <textarea
          style={{ ...S.input, height: 80, resize: "vertical" }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      {error && <div style={S.error}>{error}</div>}
      <button
        style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }}
        onClick={submit}
        disabled={saving}
      >
        {saving ? "Saving..." : isEdit ? "Save changes" : "List item"}
      </button>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  );
}

function ScreenHeader({ title, onBack }) {
  return (
    <div style={S.screenHeader}>
      <button style={S.backBtn} onClick={onBack}>
        <ArrowLeft size={18} />
      </button>
      <div style={S.screenTitle}>{title}</div>
    </div>
  );
}

/* ---------------- Item detail: chat + escrow buy flow ---------------- */

function ItemDetail({ item, user, allItems, onBack, persistItem, persistUser, showToast, submitReport }) {
  const [local, setLocal] = useState(item);
  const [message, setMessage] = useState("");
  const [sellerUser, setSellerUser] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [showRating, setShowRating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const isOwner = local.sellerMobile === user.mobile;

  // keep this screen in step with new messages / status coming from the other person
  useEffect(() => {
    setLocal((prev) => mergeItem(prev, item));
  }, [item]);
  const isBuyer = local.buyerMobile === user.mobile;

  useEffect(() => {
    (async () => {
      const s = await storageGet(`users:${local.sellerMobile}`, true);
      setSellerUser(s);
    })();
  }, [local.sellerMobile]);

  async function submitReportNow() {
    if (!reportReason.trim()) return;
    await submitReport({
      reporterMobile: user.mobile,
      reportedMobile: local.sellerMobile,
      itemId: local.id,
      reason: reportReason.trim(),
    });
    setReportReason("");
    setShowReport(false);
  }

  async function rateSeller(stars) {
    const seller = await storageGet(`users:${local.sellerMobile}`, true);
    if (seller) {
      seller.ratings = [...(seller.ratings || []), { from: user.mobile, stars, ts: Date.now(), itemId: local.id }];
      await storageSet(`users:${seller.mobile}`, seller, true);
      setSellerUser(seller);
    }
    setShowRating(false);
    setRatingDone(true);
    showToast("Thanks for rating the seller.");
  }

  async function sendMessage() {
    if (!message.trim()) return;
    const msg = { from: user.mobile, text: message.trim(), ts: Date.now() };
    setMessage("");
    setLocal((prev) => ({ ...prev, chat: [...(prev.chat || []), msg] }));
    // merge with what the other person may have written in the meantime
    const fresh = await fetchItemLive(local.id);
    const merged = mergeItem({ ...local, chat: [...(local.chat || []), msg] }, fresh);
    setLocal(merged);
    await persistItem(merged, { chat: merged.chat });
  }

  async function openEdit() {
    if (local.photos === undefined) {
      const full = await storageGet(`items:${local.id}`, true);
      setLocal((l) => ({ ...l, photos: (full && full.photos) || [] }));
    }
    setEditing(true);
  }

  async function initiateBuy() {
    if (isOwner) return; // you can't reserve your own item
    const fresh = await fetchItemLive(local.id);
    if (fresh && fresh.buyerMobile && fresh.buyerMobile !== user.mobile) {
      setLocal((prev) => mergeItem(prev, fresh));
      showToast("Sorry, someone else just reserved this item.");
      return;
    }
    const next = { ...local, buyerMobile: user.mobile, status: "reserved" };
    setLocal(next);
    await persistItem(next, { buyerMobile: next.buyerMobile, status: next.status });
    showToast("Marked as reserved — chat with the seller to arrange payment and pickup.");
  }

  const [showSupportQr, setShowSupportQr] = useState(false);

  async function confirmExchange() {
    // always start from the latest data, so we know if the other person has already confirmed
    const fresh = await fetchItemLive(local.id);
    const base = mergeItem(local, fresh);
    const confirmed = { ...(base.exchangeConfirmed || {}), [user.mobile]: true };
    const bothConfirmed = !!(base.buyerMobile && confirmed[base.buyerMobile] && confirmed[base.sellerMobile]);
    const next = {
      ...base,
      exchangeConfirmed: confirmed,
      status: bothConfirmed ? "sold" : base.status,
    };
    setLocal(next);
    await persistItem(next, { exchangeConfirmed: next.exchangeConfirmed, status: next.status });

    if (!bothConfirmed) {
      showToast(`Marked as exchanged on your side — waiting for the ${isOwner ? "buyer" : "seller"} to confirm too.`);
      return;
    }

    const seller = await storageGet(`users:${base.sellerMobile}`, true);
    if (seller) {
      seller.sold = (seller.sold || 0) + 1;
      await storageSet(`users:${seller.mobile}`, seller, true);
      if (seller.mobile === user.mobile) persistUser({ ...user, sold: seller.sold });
    }
    if (isBuyer) {
      await persistUser({ ...user, bought: (user.bought || 0) + 1 });
    } else {
      const buyerRow = await storageGet(`users:${base.buyerMobile}`, true);
      if (buyerRow) {
        buyerRow.bought = (buyerRow.bought || 0) + 1;
        await storageSet(`users:${buyerRow.mobile}`, buyerRow, true);
      }
    }
    showToast("Both sides confirmed — deal complete!");
    setShowSupportQr(true);
  }

  // The buyer is asked to rate the seller once the deal is complete, whoever confirmed last
  useEffect(() => {
    if (local.status !== "sold" || !isBuyer || ratingDone || !sellerUser) return;
    const already = (sellerUser.ratings || []).some((r) => r.from === user.mobile && r.itemId === local.id);
    if (!already) setShowRating(true);
  }, [local.status, isBuyer, ratingDone, sellerUser, local.id, user.mobile]);

  if (editing) {
    return (
      <AddItemForm
        user={user}
        initial={local}
        onCancel={() => setEditing(false)}
        onSaved={async (updated) => {
          setLocal(updated);
          await persistItem(updated);
          setEditing(false);
          showToast("Listing updated.");
        }}
      />
    );
  }

  return (
    <div>
      <ScreenHeader title={local.name} onBack={onBack} />

      <div style={S.detailPhotoRow}>
        {(local.photos && local.photos.length ? local.photos : [null]).map((p, i) => (
          <div key={i} style={S.detailPhoto}>
            {p ? <img src={p} alt="" style={S.itemCardImg} /> : <span>{local.category[0]}</span>}
          </div>
        ))}
      </div>

      <div style={S.detailPrice}>₹{local.price}</div>
      <div style={S.detailMeta}>
        <MapPin size={12} style={{ marginRight: 4 }} />
        {local.college} • {local.district}, {local.state}
      </div>
      {local.colour && <div style={S.detailMeta}>Colour: {local.colour}</div>}
      <div style={S.sellerInfoRow}>
        <Star size={12} fill={COLORS.accent} color={COLORS.accent} style={{ marginRight: 4 }} />
        {computeAvgRating(sellerUser) || "No ratings yet"}
        <span style={{ margin: "0 6px", color: COLORS.line }}>·</span>
        replies in {computeAvgReplyTime(local.sellerMobile, allItems) || "—"}
      </div>
      <div style={S.detailDesc}>{local.description}</div>

      {local.status === "reserved" && (
        <div style={S.escrowBanner}>
          <Wallet size={14} style={{ marginRight: 6 }} />
          Reserved. Arrange payment directly with {isOwner ? "the buyer" : "the seller"} (cash or UPI) — CampusKart doesn't process the payment itself.
        </div>
      )}
      {local.status === "sold" && (
        <div style={S.soldBanner}>
          <Check size={14} style={{ marginRight: 6 }} />
          Deal complete. Item marked sold.
        </div>
      )}

      {isOwner && local.status === "active" && !local.buyerMobile && (
        <button style={S.ghostBtn} onClick={openEdit}>
          Edit this listing
        </button>
      )}

      {!isOwner && local.status === "active" && !local.buyerMobile && (
        <button style={S.primaryBtn} onClick={initiateBuy}>
          I'm interested — reserve & chat
        </button>
      )}

      {showRating && (
        <div style={S.ratingBox}>
          <div style={S.chatHeader}>Rate this seller</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} style={S.starBtn} onClick={() => rateSeller(n)}>
                <Star size={22} color={COLORS.accent} />
              </button>
            ))}
          </div>
        </div>
      )}

      {isBuyer && !isOwner && (
        <div style={{ marginTop: 10 }}>
          {!showReport ? (
            <button style={S.linkDanger} onClick={() => setShowReport(true)}>
              Report this seller
            </button>
          ) : (
            <div style={S.reportBox}>
              <textarea
                style={{ ...S.input, height: 60, marginBottom: 8 }}
                placeholder="What happened? (e.g. took payment, never delivered)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.dangerBtn} onClick={submitReportNow}>
                  Submit report
                </button>
                <button style={S.ghostBtn} onClick={() => setShowReport(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {((local.buyerMobile === user.mobile && !isOwner) || (isOwner && local.buyerMobile && local.buyerMobile !== user.mobile)) && (
        <div style={S.chatBox}>
          <div style={S.chatHeader}>
            <MessageCircle size={14} style={{ marginRight: 6 }} />
            Negotiate
          </div>
          <div style={S.chatMessages}>
            {(local.chat || []).length === 0 && (
              <div style={S.emptyState}>Say hi and make an offer.</div>
            )}
            {(local.chat || []).map((m, i) => (
              <div
                key={i}
                style={{
                  ...S.chatBubble,
                  alignSelf: m.from === user.mobile ? "flex-end" : "flex-start",
                  background: m.from === user.mobile ? COLORS.accent : "#1B2338",
                  color: m.from === user.mobile ? COLORS.ink : COLORS.ink,
                }}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div style={S.chatInputRow}>
            <input
              style={{ ...S.input, marginBottom: 0, flex: 1 }}
              placeholder="Message the seller..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button style={S.sendBtn} onClick={sendMessage}>
              <Send size={16} />
            </button>
          </div>

          {local.status === "reserved" && (
            <div style={S.exchangeRow}>
              {(local.exchangeConfirmed || {})[user.mobile] ? (
                <div style={S.itemCardMeta}>
                  You've marked this as exchanged — waiting for the {isOwner ? "buyer" : "seller"} to confirm.
                </div>
              ) : (
                <button style={S.confirmBtn} onClick={confirmExchange}>
                  <Check size={16} /> We've exchanged this item
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showSupportQr && <SupportQrModal onClose={() => setShowSupportQr(false)} />}
    </div>
  );
}

/* ---------------- My items tab ---------------- */

function MyItemsTab({ user, items, allItems, view, setView, persistItem, persistUser, showToast, submitReport }) {
  if (view.name === "detail") {
    const item = items.find((i) => i.id === view.id) || view.item;
    return (
      <ItemDetail
        item={item}
        user={user}
        allItems={allItems}
        onBack={() => setView({ name: "list" })}
        persistItem={persistItem}
        persistUser={persistUser}
        showToast={showToast}
        submitReport={submitReport}
      />
    );
  }
  return (
    <div>
      <div style={S.sectionTitle}>My listings</div>
      {items.length === 0 && (
        <div style={S.emptyState}>You haven't listed anything yet.</div>
      )}
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onClick={() => setView({ name: "detail", id: item.id, item })}
        />
      ))}
    </div>
  );
}

/* ---------------- Bought tab ---------------- */

function BoughtTab({ items }) {
  return (
    <div>
      <div style={S.sectionTitle}>Items bought</div>
      {items.length === 0 && (
        <div style={S.emptyState}>Nothing purchased yet — browse Home to find something.</div>
      )}
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onClick={() => {}} />
      ))}
    </div>
  );
}

/* ---------------- Chats tab (all conversations, buyer or seller side) ---------------- */

function ChatsTab({ user, items, view, setView, persistItem, persistUser, showToast, submitReport }) {
  if (view.name === "detail") {
    const item = items.find((i) => i.id === view.id) || view.item;
    return (
      <ItemDetail
        item={item}
        user={user}
        allItems={items}
        onBack={() => setView({ name: "list" })}
        persistItem={persistItem}
        persistUser={persistUser}
        showToast={showToast}
        submitReport={submitReport}
      />
    );
  }

  const conversations = items
    .filter(
      (i) =>
        (i.sellerMobile === user.mobile || i.buyerMobile === user.mobile) &&
        i.chat &&
        i.chat.length > 0
    )
    .sort((a, b) => {
      const aLast = a.chat[a.chat.length - 1].ts;
      const bLast = b.chat[b.chat.length - 1].ts;
      return bLast - aLast;
    });

  return (
    <div>
      <div style={S.sectionTitle}>Chats</div>
      {conversations.length === 0 && (
        <div style={S.emptyState}>No conversations yet — messages you send or receive on an item will show up here.</div>
      )}
      {conversations.map((item) => {
        const lastMsg = item.chat[item.chat.length - 1];
        const iAmSeller = item.sellerMobile === user.mobile;
        return (
          <div key={item.id} style={S.itemCard} onClick={() => setView({ name: "detail", id: item.id, item })}>
            <div style={S.itemCardPhoto}>
              {item.photos && item.photos[0] ? (
                <img src={item.photos[0]} alt={item.name} style={S.itemCardImg} />
              ) : (
                <div style={S.itemCardPlaceholder}>{item.category[0]}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.itemCardName}>{item.name}</div>
              <div style={S.itemCardMeta}>
                {iAmSeller ? "Buyer" : "Seller"} · {lastMsg.text.slice(0, 40)}
                {lastMsg.text.length > 40 ? "…" : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Account tab ---------------- */

/* ---------------- Support QR modal (shown after both sides confirm an exchange) ---------------- */

/* ---------------- Support modal (feedback to admin + how exchanges work) ---------------- */

function SupportModal({ user, onSubmit, onClose, showToast }) {
  const [tab, setTab] = useState("guide"); // 'guide' | 'feedback'
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    if (!text.trim()) return;
    await onSubmit(user.mobile, text.trim());
    setText("");
    setSent(true);
    showToast("Thanks — only admins can see this, and we'll take a look.");
  }

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modalCard, maxWidth: 360, textAlign: "left", alignItems: "stretch" }}>
        <button style={S.modalClose} onClick={onClose}>
          <X size={16} />
        </button>
        <div style={{ ...S.rowGap, marginBottom: 14 }}>
          <button style={tab === "guide" ? S.chipActive : S.chip} onClick={() => setTab("guide")}>
            How it works
          </button>
          <button style={tab === "feedback" ? S.chipActive : S.chip} onClick={() => setTab("feedback")}>
            Send feedback
          </button>
        </div>

        {tab === "guide" ? (
          <div>
            <div style={S.itemCardName}>Exchanging an item, safely</div>
            <ol style={S.guideList}>
              <li>Chat with the other person first and agree on a price before doing anything else.</li>
              <li>Pick a public spot on or near campus to meet — a canteen, gate, or common area works well.</li>
              <li>Check the item in person before you pay. It's fine to ask questions or take your time.</li>
              <li>Pay directly — cash or UPI, whatever you both prefer. CampusKart doesn't handle the payment.</li>
              <li>Once you're both happy, tap "We've exchanged this item" in the chat. When both sides confirm, the deal is marked complete and you can rate each other.</li>
            </ol>
          </div>
        ) : (
          <div>
            <div style={S.itemCardName}>Tell us what's wrong (or right)</div>
            <div style={{ ...S.itemCardMeta, marginTop: 4, marginBottom: 10 }}>
              Only admins can see this — it doesn't go to the other person in any deal.
            </div>
            {sent ? (
              <div style={S.soldBanner}>
                <Check size={14} style={{ marginRight: 6 }} /> Sent — thank you!
              </div>
            ) : (
              <>
                <textarea
                  style={{ ...S.input, height: 90 }}
                  placeholder="Bug, idea, complaint — anything."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button style={S.primaryBtn} onClick={send}>
                  Send
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function SupportQrModal({ onClose }) {
  // If the placeholder UPI ID has not been replaced, don't show a QR that points to a wrong account.
  const hasRealUpi = SUPPORT_UPI_ID && SUPPORT_UPI_ID !== "campuskart@upi";
  if (!hasRealUpi) {
    return (
      <div style={S.modalOverlay}>
        <div style={S.modalCard}>
          <button style={S.modalClose} onClick={onClose}>
            <X size={16} />
          </button>
          <div style={S.itemCardName}>Deal complete! 🎉</div>
          <div style={{ ...S.itemCardMeta, marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
            Thanks for using CampusKart. Happy to have helped you pass it on.
          </div>
          <button style={{ ...S.ghostBtn, marginTop: 6 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }
  const upiLink = `upi://pay?pa=${SUPPORT_UPI_ID}&pn=${encodeURIComponent(SUPPORT_UPI_NAME)}&cu=INR`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`;
  return (
    <div style={S.modalOverlay}>
      <div style={S.modalCard}>
        <button style={S.modalClose} onClick={onClose}>
          <X size={16} />
        </button>
        <div style={S.itemCardName}>Deal complete! 🎉</div>
        <div style={{ ...S.itemCardMeta, marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
          If CampusKart made this a little easier for you, you're welcome to
          send a small thank-you our way — anything under ₹10, even ₹2 or
          ₹5, genuinely helps. Completely optional, never required — it just
          keeps this free for the rest of campus too.
        </div>
        <img src={qrSrc} alt="UPI QR code to support CampusKart" style={S.supportQr} />
        <div style={{ ...S.itemCardMeta, marginTop: 8 }}>UPI: {SUPPORT_UPI_ID}</div>
        <button style={{ ...S.ghostBtn, marginTop: 14 }} onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

function AccountTab({ user, persistUser, items, persistItem, deleteItem, promoteToAdmin, showToast, onLogout }) {
  const [upi, setUpi] = useState(user.upi || "");
  const [viewingAdmin, setViewingAdmin] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState("admin"); // 'admin' | 'items'

  async function saveUpi() {
    await persistUser({ ...user, upi });
  }

  return (
    <div>
      <div style={S.accountHeaderRow}>
        <div style={S.accountCard}>
          <div style={S.accountAvatar}>
            <User size={22} color={COLORS.paper} />
          </div>
          <div>
            <div style={S.accountMobile}>{user.fullName || "Unnamed"}</div>
            <div style={S.itemCardMeta}>+91 {user.mobile}</div>
            <div style={S.accountSub}>
              <Star size={12} style={{ marginRight: 4 }} fill={COLORS.accent} color={COLORS.accent} />
              {computeAvgRating(user) || "No ratings"} · {(user.sold || 0)} sold · {(user.bought || 0)} bought
            </div>
          </div>
        </div>

        {user.isAdmin && (
          <div style={S.adminToggleTopRight}>
            <span style={{ fontSize: 10.5, color: "#9AA6C0", marginBottom: 4 }}>
              {viewingAdmin ? "Admin view" : "User view"}
            </span>
            <button
              style={{ ...S.toggleTrack, background: viewingAdmin ? COLORS.sage : "#2A3350" }}
              onClick={() => setViewingAdmin((v) => !v)}
            >
              <span
                style={{
                  ...S.toggleThumb,
                  transform: viewingAdmin ? "translateX(18px)" : "translateX(0)",
                }}
              />
            </button>
          </div>
        )}
      </div>

      {user.isAdmin && viewingAdmin ? (
        <div style={{ marginTop: 16 }}>
          <div style={S.rowGap}>
            <button
              style={adminSubTab === "admin" ? S.chipActive : S.chip}
              onClick={() => setAdminSubTab("admin")}
            >
              Admin
            </button>
            <button
              style={adminSubTab === "items" ? S.chipActive : S.chip}
              onClick={() => setAdminSubTab("items")}
            >
              Common Items
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            {adminSubTab === "admin" ? (
              <AdminPanel
                items={items}
                persistItem={persistItem}
                deleteItem={deleteItem}
                promoteToAdmin={promoteToAdmin}
                showToast={showToast}
              />
            ) : (
              <CommonItemsPanel showToast={showToast} />
            )}
          </div>
        </div>
      ) : (
        <>
          <FormField label="UPI ID">
            <input style={S.input} value={upi} onChange={(e) => setUpi(e.target.value)} />
          </FormField>
          <button style={S.ghostBtn} onClick={saveUpi}>
            Save UPI ID
          </button>

          <div style={S.divider} />

          <div style={S.noteBox}>
            More items bought/sold raises how often your listings surface in
            search — keep closing deals to climb visibility.
          </div>
        </>
      )}

      <div style={S.divider} />

      <button style={S.ghostBtn} onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

/* ---------------- Admin panel ---------------- */

function AdminPanel({ items, persistItem, deleteItem, promoteToAdmin, showToast }) {
  const [newAdminMobile, setNewAdminMobile] = useState("");
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [browsingListings, setBrowsingListings] = useState(false);

  useEffect(() => {
    (async () => {
      const loadedReports = await sbFetchAll("reports");
      loadedReports.sort((a, b) => b.ts - a.ts);
      setReports(loadedReports);
      setLoadingReports(false);

      const loadedFeedback = await sbFetchAll("feedback");
      loadedFeedback.sort((a, b) => b.ts - a.ts);
      setFeedback(loadedFeedback);
    })();
  }, []);

  async function handlePromote() {
    if (!/^[6-9]\d{9}$/.test(newAdminMobile)) {
      showToast("Enter a valid registered mobile number.");
      return;
    }
    await promoteToAdmin(newAdminMobile);
    setNewAdminMobile("");
  }

  if (browsingListings) {
    return (
      <AdminListingsBrowser
        items={items}
        persistItem={persistItem}
        deleteItem={deleteItem}
        showToast={showToast}
        onBack={() => setBrowsingListings(false)}
      />
    );
  }

  return (
    <div>
      <div style={S.sectionTitle}>
        <Shield size={14} style={{ marginRight: 6 }} />
        Admin
      </div>

      <FormField label="Make someone else admin">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...S.input, marginBottom: 0, flex: 1 }}
            placeholder="10-digit mobile number"
            value={newAdminMobile}
            maxLength={10}
            onChange={(e) => setNewAdminMobile(e.target.value.replace(/\D/g, ""))}
          />
          <button style={S.ghostBtn} onClick={handlePromote}>
            Promote
          </button>
        </div>
      </FormField>

      <div style={S.divider} />

      <div style={{ ...S.itemCardName, marginBottom: 10 }}>
        Reports ({reports.length})
      </div>
      {!loadingReports && reports.length === 0 && (
        <div style={S.emptyState}>No reports filed.</div>
      )}
      {reports.map((r) => (
        <div key={r.id} style={S.adminRow}>
          <div style={{ flex: 1 }}>
            <div style={S.itemCardName}>
              {r.reporterMobile} reported {r.reportedMobile}
            </div>
            <div style={S.itemCardMeta}>{r.reason}</div>
          </div>
        </div>
      ))}

      <div style={S.divider} />

      <div style={{ ...S.itemCardName, marginBottom: 10 }}>
        Feedback ({feedback.length})
      </div>
      {feedback.length === 0 && <div style={S.emptyState}>No feedback yet.</div>}
      {feedback.map((f) => (
        <div key={f.id} style={S.adminRow}>
          <div style={{ flex: 1 }}>
            <div style={S.itemCardName}>{f.mobile}</div>
            <div style={S.itemCardMeta}>{f.text}</div>
          </div>
        </div>
      ))}

      <div style={S.divider} />

      <div style={{ ...S.itemCardName, marginBottom: 10 }}>
        All listings ({items.length})
      </div>
      <button style={S.ghostBtn} onClick={() => setBrowsingListings(true)}>
        Browse & filter listings
      </button>
    </div>
  );
}

/* ---------------- Admin listings browser (filter by college/district/state/item) ---------------- */

function AdminListingsBrowser({ items, persistItem, deleteItem, showToast, onBack }) {
  const [college, setCollege] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setStateField] = useState("");
  const [itemName, setItemName] = useState("");

  const [reviewId, setReviewId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function toggleBlock(item) {
    await persistItem({ ...item, blocked: !item.blocked }, { blocked: !item.blocked });
  }

  async function removeListing(item) {
    await deleteItem(item.id);
    setReviewId(null);
    setConfirmRemove(false);
    if (showToast) showToast("Listing removed.");
  }

  const reviewing = reviewId ? items.find((i) => i.id === reviewId) : null;
  if (reviewing) {
    const it = reviewing;
    return (
      <div>
        <ScreenHeader
          title="Review listing"
          onBack={() => {
            setReviewId(null);
            setConfirmRemove(false);
          }}
        />
        <div style={S.detailPhotoRow}>
          {(it.photos && it.photos.length ? it.photos : [null]).map((ph, i) => (
            <div key={i} style={S.detailPhoto}>
              {ph ? <img src={ph} alt="" style={S.itemCardImg} /> : <span>{(it.category || "?")[0]}</span>}
            </div>
          ))}
        </div>
        <div style={S.itemCardName}>{it.name}</div>
        <div style={{ ...S.itemCardMeta, marginTop: 4 }}>
          ₹{it.price} · {it.category}
          {it.colour ? ` · ${it.colour}` : ""}
        </div>
        <div style={{ ...S.itemCardMeta, marginTop: 4 }}>
          {it.college}, {it.district}, {it.state}
        </div>
        <div style={{ ...S.itemCardMeta, marginTop: 4 }}>
          Seller: {it.sellerMobile} · Status: {it.status}
          {it.blocked ? " · blocked" : ""}
        </div>
        <div style={{ ...S.itemCardMeta, marginTop: 4 }}>
          Listed: {it.createdAt ? new Date(it.createdAt).toLocaleString() : "—"}
        </div>
        <div style={{ ...S.noteBox, marginTop: 12, marginBottom: 14, whiteSpace: "pre-wrap" }}>
          {it.description || "No description."}
        </div>
        <button
          style={{ ...(it.blocked ? S.ghostBtn : S.dangerBtn), width: "100%", justifyContent: "center", marginBottom: 10 }}
          onClick={() => toggleBlock(it)}
        >
          {it.blocked ? "Unblock this listing" : "Block (hide) this listing"}
        </button>
        {!confirmRemove ? (
          <button
            style={{ ...S.dangerBtn, width: "100%", justifyContent: "center" }}
            onClick={() => setConfirmRemove(true)}
          >
            Remove this listing
          </button>
        ) : (
          <div>
            <div style={{ ...S.itemCardMeta, marginBottom: 8, color: COLORS.crimson }}>
              This deletes the listing and its chat for good. Are you sure?
            </div>
            <button
              style={{ ...S.dangerBtn, width: "100%", justifyContent: "center", marginBottom: 8 }}
              onClick={() => removeListing(it)}
            >
              Yes, remove it permanently
            </button>
            <button style={{ ...S.ghostBtn, width: "100%", justifyContent: "center" }} onClick={() => setConfirmRemove(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const filtered = items.filter((i) => {
    if (college && i.college !== college) return false;
    if (district && !i.district.toLowerCase().includes(district.toLowerCase())) return false;
    if (state && !i.state.toLowerCase().includes(state.toLowerCase())) return false;
    if (itemName && !i.name.toLowerCase().includes(itemName.toLowerCase())) return false;
    return true;
  });

  const anyFilterSet = college || district || state || itemName;

  return (
    <div>
      <ScreenHeader title="Browse listings" onBack={onBack} />

      <FormField label="College">
        <select style={S.input} value={college} onChange={(e) => setCollege(e.target.value)}>
          <option value="">All colleges</option>
          {COLLEGES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FormField>
      <FormField label="District / city">
        <input
          style={S.input}
          placeholder="e.g. Faridabad"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
        />
      </FormField>
      <FormField label="State">
        <input
          style={S.input}
          placeholder="e.g. Haryana"
          value={state}
          onChange={(e) => setStateField(e.target.value)}
        />
      </FormField>
      <FormField label="Item name">
        <input
          style={S.input}
          placeholder="e.g. Workshop Dress"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
      </FormField>

      <div style={{ ...S.itemCardMeta, marginBottom: 10 }}>
        {anyFilterSet ? `${filtered.length} matching listings` : `${items.length} total listings — set a filter above to narrow down`}
      </div>

      {filtered.map((item) => (
        <div key={item.id} style={S.adminRow}>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setReviewId(item.id)}>
            <div style={S.itemCardName}>{item.name}</div>
            <div style={S.itemCardMeta}>
              {item.college} · seller {item.sellerMobile} · {item.status}
              {item.blocked ? " · blocked" : ""}
            </div>
            <div style={{ ...S.itemCardMeta, color: COLORS.accent }}>Tap to review</div>
          </div>
          <button
            style={item.blocked ? S.ghostBtn : S.dangerBtn}
            onClick={() => toggleBlock(item)}
          >
            {item.blocked ? <Check size={13} /> : <X size={13} />}
            {item.blocked ? "Unblock" : "Block"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Common items panel (per-college presets) ---------------- */

function CommonItemsPanel({ showToast }) {
  const [presetCollege, setPresetCollege] = useState(COLLEGES[0]);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");
  const [presetCategory, setPresetCategory] = useState(CATEGORIES[0]);
  const [presetColours, setPresetColours] = useState("");

  useEffect(() => {
    (async () => {
      const list = (await storageGet(`default-items:${presetCollege}`, true)) || [];
      setPresets(list);
    })();
  }, [presetCollege]);

  async function addPreset() {
    if (!presetName.trim()) return;
    const next = [
      ...presets,
      {
        name: presetName.trim(),
        category: presetCategory,
        colours: presetColours
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      },
    ];
    setPresets(next);
    await storageSet(`default-items:${presetCollege}`, next, true);
    setPresetName("");
    setPresetColours("");
    showToast(`Added to ${presetCollege}'s common items.`);
  }

  async function removePreset(idx) {
    const next = presets.filter((_, i) => i !== idx);
    setPresets(next);
    await storageSet(`default-items:${presetCollege}`, next, true);
  }

  return (
    <div>
      <div style={S.sectionTitle}>Common items for a college</div>
      <FormField label="College">
        <select style={S.input} value={presetCollege} onChange={(e) => setPresetCollege(e.target.value)}>
          {COLLEGES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FormField>
      {presets.length === 0 && (
        <div style={S.emptyState}>No common items added for this college yet.</div>
      )}
      {presets.map((p, i) => (
        <div key={i} style={S.adminRow}>
          <div style={{ flex: 1 }}>
            <div style={S.itemCardName}>{p.name}</div>
            <div style={S.itemCardMeta}>
              {p.category}
              {p.colours && p.colours.length > 0 ? ` · ${p.colours.join(", ")}` : ""}
            </div>
          </div>
          <button style={S.dangerBtn} onClick={() => removePreset(i)}>
            <X size={13} /> Remove
          </button>
        </div>
      ))}
      <div style={S.divider} />
      <FormField label="Item name (e.g. Workshop Dress, Mini Drafter)">
        <input style={S.input} value={presetName} onChange={(e) => setPresetName(e.target.value)} />
      </FormField>
      <FormField label="Category">
        <select style={S.input} value={presetCategory} onChange={(e) => setPresetCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Colour options (comma separated, optional)">
        <input
          style={S.input}
          placeholder="Green, Brown, Grey"
          value={presetColours}
          onChange={(e) => setPresetColours(e.target.value)}
        />
      </FormField>
      <button style={S.ghostBtn} onClick={addPreset}>
        Add to {presetCollege.split(",")[0]}
      </button>
    </div>
  );
}

/* ---------------- Design tokens & styles ---------------- */

const COLORS = {
  bg: "#080B14",       // page background — near black
  surface: "#131A2B",  // elevated cards/panels/inputs
  ink: "#E9EDF7",      // primary text (light, for dark backgrounds)
  paper: "#F5F8FF",     // text/icons sitting on top of accent-coloured elements
  accent: "#3D7BF5",   // blue accent — buttons, active states, links
  sage: "#34D399",     // success/trust green, brightened for dark bg
  crimson: "#F2665B",  // alerts, brightened for dark bg
  line: "#232B42",     // borders on dark surfaces
  cardBg: "#131A2B",   // same as surface — kept as a separate token for clarity at call sites
};

const fontHead = "'Fraunces', Georgia, serif";
const fontBody = "'Work Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const S = {
  bootWrap: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.bg,
    fontFamily: fontHead,
  },
  bootMark: { fontSize: 24, color: COLORS.ink, letterSpacing: 0.2 },
  appShell: {
    maxWidth: 480,
    width: "100%",
    margin: "0 auto",
    background: COLORS.bg,
    height: "100dvh",
    display: "flex",
    flexDirection: "column",
    fontFamily: fontBody,
    borderLeft: `1px solid ${COLORS.line}`,
    borderRight: `1px solid ${COLORS.line}`,
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 18px 12px",
    borderBottom: `1px solid ${COLORS.line}`,
  },
  topBarBrand: {
    fontFamily: fontHead,
    fontSize: 20,
    color: COLORS.ink,
    fontWeight: 600,
  },
  adminPill: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: COLORS.sage,
    border: `1px solid ${COLORS.sage}`,
    borderRadius: 20,
    padding: "3px 9px",
  },
  supportIconBtn: {
    background: "none",
    border: "none",
    color: "#9AA6C0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    padding: 2,
  },
  screen: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    padding: "16px 16px calc(96px + env(safe-area-inset-bottom, 0px))",
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    display: "flex",
    background: COLORS.cardBg,
    borderTop: `1px solid ${COLORS.line}`,
    padding: "8px 0 calc(10px + env(safe-area-inset-bottom, 0px))",
  },
  tabBtn: {
    flex: 1,
    background: "none",
    border: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    background: COLORS.accent,
    marginTop: 4,
  },
  loginWrap: {
    minHeight: "100dvh",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.bg,
    padding: 20,
    fontFamily: fontBody,
  },
  loginCard: {
    background: COLORS.surface,
    borderRadius: 16,
    padding: "32px 26px",
    width: "100%",
    maxWidth: 360,
  },
  brand: { fontFamily: fontHead, fontSize: 28, color: COLORS.ink, marginBottom: 4 },
  brandSub: { fontSize: 13, color: "#9AA6C0", marginBottom: 26 },
  label: { display: "block", fontSize: 12, color: "#9AA6C0", marginBottom: 5, marginTop: 2 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 13px",
    borderRadius: 10,
    border: `1px solid ${COLORS.line}`,
    background: COLORS.surface,
    fontSize: 14,
    color: COLORS.ink,
    marginBottom: 14,
    fontFamily: fontBody,
  },
  error: { color: COLORS.crimson, fontSize: 12.5, marginBottom: 10 },
  primaryBtn: {
    width: "100%",
    background: COLORS.accent,
    color: COLORS.ink,
    border: "none",
    borderRadius: 10,
    padding: "12px 0",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: fontBody,
  },
  linkBtn: {
    width: "100%",
    background: "none",
    border: "none",
    color: "#9AA6C0",
    fontSize: 12.5,
    marginTop: 10,
    cursor: "pointer",
    textDecoration: "underline",
  },
  ghostBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: "9px 14px",
    fontSize: 13,
    color: COLORS.ink,
    cursor: "pointer",
    fontFamily: fontBody,
  },
  ctaBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: COLORS.accent,
    border: "none",
    borderRadius: 10,
    padding: "9px 16px",
    fontSize: 13,
    color: COLORS.paper,
    cursor: "pointer",
    fontFamily: fontBody,
    fontWeight: 600,
  },
  rowGap: { display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" },
  promoBanner: {
    background: COLORS.surface,
    borderRadius: 14,
    padding: "18px 18px 20px",
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  promoBannerTitle: {
    fontFamily: fontHead,
    fontSize: 20,
    color: COLORS.paper,
    marginBottom: 14,
    maxWidth: 230,
    lineHeight: 1.2,
  },
  promoBannerKicker: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: COLORS.accent,
    fontWeight: 600,
    marginBottom: 6,
  },
  promoStatsRow: { display: "flex", gap: 22 },
  promoStat: { display: "flex", flexDirection: "column" },
  promoStatNum: {
    fontFamily: fontHead,
    fontSize: 20,
    color: COLORS.paper,
  },
  promoStatLabel: {
    fontSize: 10.5,
    color: "#B7C6EF",
    marginTop: 1,
  },
  promoBannerAccent: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: COLORS.accent,
    opacity: 0.9,
  },
  searchPanel: {
    marginTop: 12,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: 12,
  },
  chip: {
    background: "#1B2338",
    border: "none",
    borderRadius: 20,
    padding: "6px 13px",
    fontSize: 12.5,
    color: "#9AA6C0",
    cursor: "pointer",
  },
  chipActive: {
    background: COLORS.accent,
    border: "none",
    borderRadius: 20,
    padding: "6px 13px",
    fontSize: 12.5,
    color: COLORS.paper,
    cursor: "pointer",
  },
  emptyState: { fontSize: 13, color: "#7C86A0", padding: "24px 4px", textAlign: "center" },
  itemCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    padding: 10,
    marginBottom: 10,
    cursor: "pointer",
    clipPath:
      "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)",
  },
  itemCardPhoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    background: "#1B2338",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemCardImg: { width: "100%", height: "100%", objectFit: "cover" },
  itemCardPlaceholder: { fontFamily: fontHead, fontSize: 20, color: "#6B7690" },
  itemCardName: { fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 2 },
  itemCardMeta: { fontSize: 11.5, color: "#7C86A0", display: "flex", alignItems: "center" },
  escrowBadge: { fontSize: 10.5, color: COLORS.sage, marginTop: 3 },
  soldBadge: { fontSize: 10.5, color: COLORS.crimson, marginTop: 3 },
  priceTag: {
    fontFamily: fontHead,
    fontSize: 15,
    color: COLORS.ink,
    background: "#182035",
    padding: "3px 9px",
    borderRadius: 6,
    flexShrink: 0,
  },
  formPhotoRow: { display: "flex", gap: 10, marginBottom: 16 },
  photoSlot: {
    width: 84,
    height: 84,
    borderRadius: 10,
    border: `1.5px dashed ${COLORS.line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    overflow: "hidden",
    background: COLORS.surface,
  },
  photoPreview: { width: "100%", height: "100%", objectFit: "cover" },
  screenHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  backBtn: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 8,
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  screenTitle: { fontFamily: fontHead, fontSize: 18, color: COLORS.ink },
  detailPhotoRow: { display: "flex", gap: 8, marginBottom: 14 },
  detailPhoto: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    background: "#1B2338",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: fontHead,
    fontSize: 30,
    color: "#6B7690",
  },
  detailPrice: { fontFamily: fontHead, fontSize: 26, color: COLORS.ink },
  detailMeta: { fontSize: 12.5, color: "#9AA6C0", display: "flex", alignItems: "center", marginTop: 3 },
  detailDesc: { fontSize: 13.5, color: COLORS.ink, marginTop: 12, lineHeight: 1.5 },
  sellerInfoRow: {
    display: "flex",
    alignItems: "center",
    fontSize: 12,
    color: "#9AA6C0",
    marginTop: 8,
  },
  ratingBox: {
    marginTop: 14,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: 12,
  },
  starBtn: { background: "none", border: "none", cursor: "pointer", padding: 2 },
  linkDanger: {
    background: "none",
    border: "none",
    color: COLORS.crimson,
    fontSize: 12.5,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  reportBox: {
    marginTop: 8,
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: 12,
  },
  escrowBanner: {
    display: "flex",
    alignItems: "center",
    background: "#12213F",
    color: "#9CC0FF",
    fontSize: 12.5,
    padding: "10px 12px",
    borderRadius: 10,
    marginTop: 14,
  },
  soldBanner: {
    display: "flex",
    alignItems: "center",
    background: "#0F2B22",
    color: COLORS.sage,
    fontSize: 12.5,
    padding: "10px 12px",
    borderRadius: 10,
    marginTop: 14,
  },
  confirmBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    background: COLORS.sage,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 0",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 14,
    fontFamily: fontBody,
  },
  chatBox: {
    marginTop: 20,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    background: COLORS.surface,
    padding: 12,
  },
  chatHeader: { display: "flex", alignItems: "center", fontSize: 12.5, color: "#9AA6C0", marginBottom: 8 },
  chatMessages: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto", marginBottom: 10 },
  chatBubble: { maxWidth: "75%", padding: "7px 11px", borderRadius: 12, fontSize: 13 },
  chatInputRow: { display: "flex", gap: 8, alignItems: "center" },
  exchangeRow: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` },
  sendBtn: {
    background: COLORS.accent,
    border: "none",
    borderRadius: 9,
    width: 38,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.paper,
    cursor: "pointer",
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: fontHead,
    fontSize: 16,
    color: COLORS.ink,
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
  },
  accountCard: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
  accountHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  adminToggleTopRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: COLORS.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  accountMobile: { fontSize: 15, fontWeight: 600, color: COLORS.ink },
  accountSub: { fontSize: 12, color: "#9AA6C0", display: "flex", alignItems: "center", marginTop: 2 },
  divider: { height: 1, background: COLORS.line, margin: "18px 0" },
  toggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: "none",
    cursor: "pointer",
    position: "relative",
    padding: 2,
    transition: "background 0.15s",
  },
  toggleThumb: {
    display: "block",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    transition: "transform 0.15s",
  },
  noteBox: { fontSize: 12.5, color: "#9AA6C0", lineHeight: 1.5 },
  supportBox: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  supportQr: { width: 140, height: 140, borderRadius: 8 },
  modalOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(3,5,10,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  modalCard: {
    position: "relative",
    background: COLORS.surface,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 16,
    padding: "24px 20px 20px",
    width: "100%",
    maxWidth: 320,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  modalClose: {
    position: "absolute",
    top: 12,
    right: 12,
    background: "none",
    border: "none",
    color: "#9AA6C0",
    cursor: "pointer",
  },
  adminRow: { display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${COLORS.line}`, padding: "10px 0" },
  guideList: {
    margin: "10px 0 0",
    paddingLeft: 18,
    fontSize: 13,
    color: COLORS.ink,
    lineHeight: 1.6,
  },
  dangerBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: COLORS.surface,
    border: `1px solid ${COLORS.crimson}`,
    color: COLORS.crimson,
    borderRadius: 8,
    padding: "5px 10px",
    fontSize: 11.5,
    cursor: "pointer",
  },
  toast: {
    position: "absolute",
    bottom: 78,
    left: 18,
    right: 18,
    background: COLORS.surface,
    color: COLORS.paper,
    padding: "10px 14px",
    borderRadius: 10,
    fontSize: 12.5,
    textAlign: "center",
  },
};
