export type Intent = 'weather_outfit' | 'food_recommend' | 'recipe' | 'hotel_recommend' | 'route_plan' | 'nearby_search' | 'reminder' | 'home_care' | 'day_plan' | 'checklist' | 'chitchat'
export type Point = { lng: number; lat: number }
export type WeatherCard = {
  type: 'weather'; city: string; temperature: number; condition: string; low: number; high: number
  feelsLike: number; humidity: number; wind: string; outfit: string[]; tip: string
  hourly: { time: string; temperature: number; condition: string }[]
}
export type Restaurant = {
  id: string; name: string; category: string; rating: number; price: number; distance: string
  walkMinutes: number; tags: string[]; address: string; point: Point; color: string
}
export type RestaurantsCard = { type: 'restaurants'; title: string; items: Restaurant[] }
export type RecipeCard = {
  type: 'recipe'; name: string; minutes: number; servings: number; difficulty: string
  ingredients: { name: string; amount: string }[]; steps: string[]; tip: string
}
export type Hotel = {
  id: string; name: string; area: string; rating: number; price: number; tags: string[]
  address: string; point: Point; description: string
}
export type HotelsCard = { type: 'hotels'; title: string; items: Hotel[] }
export type RouteMode = 'walking' | 'transit' | 'driving' | 'cycling'
export type RouteOption = {
  mode: RouteMode; label: string; minutes: number; distance: string; cost: string; steps: string[]; points: Point[]
}
export type RouteCard = {
  type: 'route'; origin: string; destination: string; originPoint: Point; destinationPoint: Point
  options: RouteOption[]; recommended: RouteMode
}
export type Place = { id: string; name: string; category: string; distance: string; address: string; point: Point }
export type PlacesCard = { type: 'places'; title: string; items: Place[] }
export type ReminderCard = { type: 'reminder'; id: string; title: string; dueAt: string; note: string }
export type HomeCard = { type: 'home'; title: string; tasks: { title: string; detail: string }[] }
export type ItineraryStop = { time: string; title: string; detail: string; address: string; point: Point; route?: string }
export type ItineraryCard = { type: 'itinerary'; id: string; title: string; stops: ItineraryStop[] }
export type ChecklistCard = { type: 'checklist'; id: string; title: string; groups: { name: string; items: string[] }[] }
export type ForecastDay = { label: string; condition: string; low: number; high: number; rain: number; advice: string }
export type ForecastCard = { type: 'forecast'; city: string; days: ForecastDay[]; tip: string }
export type AgentCard = WeatherCard | RestaurantsCard | RecipeCard | HotelsCard | RouteCard | PlacesCard | ReminderCard | HomeCard
  | ItineraryCard | ChecklistCard | ForecastCard
export type ChatRequest = { conversationId: string; query: string; city: string; history?: { role: 'user' | 'assistant'; content: string }[] }
export type StepStatus = 'pending' | 'running' | 'done'
export type PlanStep = { id: string; title: string; status: StepStatus }
export type ChatEvent =
  | { type: 'status'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'plan'; steps: { id: string; title: string }[] }
  | { type: 'step'; id: string; status: 'running' | 'done' }
  | { type: 'delta'; text: string }
  | { type: 'card'; card: AgentCard }
  | { type: 'suggestions'; items: string[] }
  | { type: 'done'; intent: Intent }
  | { type: 'error'; message: string }
export type MessageState = 'pending' | 'streaming' | 'done' | 'error' | 'aborted'
export type Message = {
  id: string; role: 'user' | 'assistant'; content: string; createdAt: string; state: MessageState
  cards: AgentCard[]; suggestions: string[]; statusText?: string; error?: string; query?: string
  thinking?: string; steps?: PlanStep[]; thinkingMs?: number
}
export type Conversation = { id: string; title: string; createdAt: string; updatedAt: string; messages: Message[] }
export type HomeOverview = {
  city: string; date: string; temperature: number; condition: string; low: number; high: number
  airQuality: string; outfitTip: string; dailyTip: string
}
export type SavedItem = { id: string; kind: 'restaurant' | 'hotel' | 'recipe' | 'reminder' | 'task'; title: string; detail: string; done: boolean; createdAt: string; dueAt?: string }
