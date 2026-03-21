// ============================================================================
// Allturf CRM — TypeScript Types & Domain Constants
// 1:1 mirror of supabase/schema.sql (Phase 1.1 + 1.2)
// ============================================================================

// ============================================================================
// CONSTANTS — all use `as const` for type narrowing
// ============================================================================

export const QUOTE_STAGES = [
  'Quote Draft',
  'Quote Sent',
  'Quote Approved',
  'Order Placed',
  'Shipped',
  'Delivered',
  'Invoiced',
  'Paid',
  'Closed Lost',
] as const;
export type QuoteStage = (typeof QUOTE_STAGES)[number];

export const CONTACT_STATUSES = [
  'New',
  'No Answer',
  'Left Voicemail',
  'Follow Up',
  'Active Customer',
  'Inactive',
  'Prospect',
  'Do Not Contact',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const INDUSTRIES = [
  'Golf Course',
  'Sports Turf',
  'Municipal Parks',
  'Landscaping',
  'Other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const ACTIVITY_TYPES = [
  'Phone Call',
  'Email',
  'Site Visit',
  'Meeting',
  'Note',
  'Product Demo',
  'Sample Drop-off',
  'Follow Up',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const PRODUCT_CATEGORIES = [
  'Fungicide',
  'Herbicide',
  'Insecticide',
  'Fertilizer',
  'Seed',
  'Wetting Agent',
  'Growth Regulator',
  'Adjuvant',
  'Other',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CONTACT_ROLES = [
  'Superintendent',
  'Assistant Superintendent',
  'Grounds Crew',
  'General Manager',
  'Director of Agronomy',
  'Owner',
  'Purchasing',
] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_TYPES = [
  'Spring Program',
  'Summer Program',
  'Fall Program',
  'Winter Prep',
  'Full Season',
  'Custom',
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  'Not Started',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['To Do', 'In Progress', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const EVENT_TYPES = [
  'meeting',
  'networking',
  'vacation',
  'site_visit',
  'delivery',
  'demo',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;
export type Province = (typeof PROVINCES)[number];

// --- Phase 1.2 domain constants ---

export const COURSE_TYPES = [
  'Private',
  'Public',
  'Semi-Private',
  'Resort',
  'Municipal',
] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

export const GRASS_TYPES = [
  'Bentgrass',
  'Kentucky Bluegrass',
  'Perennial Ryegrass',
  'Fine Fescue',
  'Tall Fescue',
  'Poa annua',
  'Bermudagrass',
  'Zoysiagrass',
  'Mixed Stand',
] as const;
export type GrassType = (typeof GRASS_TYPES)[number];

export const SOIL_TYPES = [
  'Sand-based',
  'Clay',
  'Loam',
  'Sandy Loam',
  'Clay Loam',
  'Silt Loam',
  'Peat',
  'Modified Sand',
  'USGA Spec',
] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const IRRIGATION_TYPES = [
  'Full Automatic',
  'Semi-Automatic',
  'Manual',
  'Hand Watering Only',
  'None',
] as const;
export type IrrigationType = (typeof IRRIGATION_TYPES)[number];

export const MAINTENANCE_LEVELS = [
  'Championship',
  'High',
  'Standard',
  'Budget',
] as const;
export type MaintenanceLevel = (typeof MAINTENANCE_LEVELS)[number];

export const CONDITION_RATINGS = [
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Critical',
] as const;
export type ConditionRating = (typeof CONDITION_RATINGS)[number];

export const VISIT_TYPES = [
  'Routine Inspection',
  'Problem Diagnosis',
  'Product Application Check',
  'Pre-Season Assessment',
  'Post-Season Review',
  'Emergency',
] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const ORDER_TYPES = [
  'Standard',
  'Seasonal Program',
  'Emergency',
  'Re-Order',
] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const DELIVERY_STATUSES = [
  'Scheduled',
  'In Transit',
  'Delivered',
  'Partial',
  'Cancelled',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DISEASE_PEST_TYPES = [
  'Disease',
  'Pest',
  'Weed',
] as const;
export type DiseasePestType = (typeof DISEASE_PEST_TYPES)[number];

export const EFFICACY_RATINGS = [
  'Excellent',
  'Good',
  'Fair',
  'Preventive Only',
] as const;
export type EfficacyRating = (typeof EFFICACY_RATINGS)[number];

export const RECOMMENDATION_PRIORITIES = [
  'Immediate',
  'This Week',
  'This Month',
  'Seasonal',
] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export const KNOWLEDGE_CATEGORIES = [
  'disease',
  'pest',
  'cultural_practice',
  'regulation',
  'product_tip',
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const COMMON_DISEASES = [
  'Dollar Spot',
  'Gray Snow Mold (Typhula Blight)',
  'Pink Snow Mold (Microdochium Patch)',
  'Pythium Blight',
  'Brown Patch (Rhizoctonia)',
  'Fairy Ring',
  'Anthracnose',
  'Summer Patch',
  'Red Thread',
  'Necrotic Ring Spot',
  'Take-All Patch',
  'Leaf Spot (Bipolaris)',
  'Rust',
  'Gray Leaf Spot',
  'Fusarium Patch',
] as const;
export type CommonDisease = (typeof COMMON_DISEASES)[number];

export const COMMON_PESTS = [
  'White Grubs (European Chafer)',
  'White Grubs (Japanese Beetle)',
  'Chinch Bugs',
  'Crane Fly Larvae',
  'Annual Bluegrass Weevil (ABW)',
  'Sod Webworm',
  'Cutworms',
  'Armyworms',
] as const;
export type CommonPest = (typeof COMMON_PESTS)[number];

export const MOA_GROUPS = [
  'Group 1 (MBC)',
  'Group 2 (Dicarboximide)',
  'Group 3 (DMI)',
  'Group 7 (SDHI)',
  'Group 11 (QoI/Strobilurin)',
  'Group 12 (Phenylpyrrole)',
  'Group 14 (Aromatic Hydrocarbon)',
  'Group 21 (QiI)',
  'Group 28 (Carbamate)',
  'Group 29 (2,6-Dinitroaniline)',
  'Group M1 (Inorganic/Copper)',
  'Group M3 (Dithiocarbamate)',
  'Group M5 (Chloronitrile)',
  'Multiple',
] as const;
export type MoaGroup = (typeof MOA_GROUPS)[number];

export const APPLICATION_RATE_UNITS = [
  'L/ha',
  'mL/100m²',
  'kg/ha',
  'g/100m²',
  'L/1000ft²',
  'oz/1000ft²',
  'lb/1000ft²',
  'g/m²',
] as const;
export type ApplicationRateUnit = (typeof APPLICATION_RATE_UNITS)[number];

export const SIGNAL_WORDS = [
  'Danger',
  'Warning',
  'Caution',
] as const;
export type SignalWord = (typeof SIGNAL_WORDS)[number];

// ============================================================================
// COLOR MAPS
// ============================================================================

export const STAGE_COLORS: Record<QuoteStage, string> = {
  'Quote Draft': 'bg-slate-100 text-slate-700',
  'Quote Sent': 'bg-blue-100 text-blue-700',
  'Quote Approved': 'bg-indigo-100 text-indigo-700',
  'Order Placed': 'bg-violet-100 text-violet-700',
  'Shipped': 'bg-amber-100 text-amber-700',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Invoiced': 'bg-cyan-100 text-cyan-700',
  'Paid': 'bg-green-100 text-green-800',
  'Closed Lost': 'bg-red-100 text-red-700',
};

export const STATUS_COLORS: Record<ContactStatus, string> = {
  'New': 'bg-blue-100 text-blue-700',
  'No Answer': 'bg-slate-100 text-slate-600',
  'Left Voicemail': 'bg-yellow-100 text-yellow-700',
  'Follow Up': 'bg-orange-100 text-orange-700',
  'Active Customer': 'bg-green-100 text-green-700',
  'Inactive': 'bg-gray-100 text-gray-500',
  'Prospect': 'bg-purple-100 text-purple-700',
  'Do Not Contact': 'bg-red-100 text-red-700',
};

export const CATEGORY_COLORS: Record<ProductCategory, string> = {
  'Fungicide': 'bg-teal-100 text-teal-700',
  'Herbicide': 'bg-lime-100 text-lime-700',
  'Insecticide': 'bg-rose-100 text-rose-700',
  'Fertilizer': 'bg-emerald-100 text-emerald-700',
  'Seed': 'bg-amber-100 text-amber-700',
  'Wetting Agent': 'bg-sky-100 text-sky-700',
  'Growth Regulator': 'bg-violet-100 text-violet-700',
  'Adjuvant': 'bg-indigo-100 text-indigo-700',
  'Other': 'bg-gray-100 text-gray-600',
};

export const CONDITION_COLORS: Record<ConditionRating, string> = {
  'Excellent': 'bg-green-100 text-green-700',
  'Good': 'bg-emerald-100 text-emerald-700',
  'Fair': 'bg-yellow-100 text-yellow-700',
  'Poor': 'bg-orange-100 text-orange-700',
  'Critical': 'bg-red-100 text-red-700',
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  'Scheduled': 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-amber-100 text-amber-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Partial': 'bg-orange-100 text-orange-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

// ============================================================================
// INTERFACES — Phase 1.1 (core tables)
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  approved: boolean;
  territory: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  industry: Industry | null;
  website: string | null;
  city: string | null;
  province: Province | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  golf_course_profile?: GolfCourseProfile | null;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  company_id: string | null;
  role: ContactRole | null;
  status: ContactStatus;
  preferred_contact_method: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  company?: Company | null;
}

export interface Offering {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: ProductCategory;
  is_active: boolean;
  manufacturer: string | null;
  active_ingredients: string[] | null;
  pcp_registration_number: string | null;
  application_rate_min: number | null;
  application_rate_max: number | null;
  application_rate_unit: string | null;
  pack_sizes: Record<string, unknown> | null;
  target_diseases: string[] | null;
  target_pests: string[] | null;
  compatible_tank_mixes: string[] | null;
  seasonal_availability: string[] | null;
  re_entry_interval_hours: number | null;
  rain_fast_hours: number | null;
  signal_word: string | null;
  mode_of_action: string | null;
  moa_group: string | null;
  sds_url: string | null;
  label_pdf_url: string | null;
  ontario_class: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  name: string;
  company_id: string | null;
  contact_id: string | null;
  stage: QuoteStage;
  value_cad: number;
  notes: string | null;
  order_type: OrderType | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  po_number: string | null;
  season: string | null;
  assigned_rep_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  company?: Company | null;
  contact?: Contact | null;
  deal_items?: DealItem[];
}

export interface DealItem {
  id: string;
  deal_id: string;
  offering_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  notes: string | null;
  coverage_area_m2: number | null;
  application_count: number | null;
  pack_size_label: string | null;
  application_rate: number | null;
  target_area: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  offering?: Offering | null;
}

export interface Activity {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  type: ActivityType;
  summary: string | null;
  ai_summary: string | null;
  assigned_rep_id: string | null;
  visit_report_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  contact?: Contact | null;
  deal?: Deal | null;
  assigned_rep?: UserProfile | null;
  visit_report?: VisitReport | null;
}

export interface Project {
  id: string;
  name: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  project_type: ProjectType;
  status: ProjectStatus;
  sales_owner: string | null;
  project_lead: string | null;
  team_members: string[];
  description: string | null;
  value_cad: number;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  season_year: number | null;
  total_budget: number | null;
  spent_to_date: number;
  assigned_rep_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  company?: Company | null;
  contact?: Contact | null;
  deal?: Deal | null;
}

// Alias for turf-domain UI
export type TreatmentProgram = Project;

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee: string | null;
  priority: TaskPriority;
  due_date: string | null;
  sort_order: number;
  application_date: string | null;
  product_id: string | null;
  application_rate: number | null;
  target_area: string | null;
  weather_window_start: string | null;
  weather_window_end: string | null;
  gdd_threshold: number | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  product?: Offering | null;
}

// Alias for turf-domain UI
export type TreatmentProgramItem = ProjectTask;

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  team_member: string;
  location: string | null;
  company_id: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  company?: Company | null;
  contact?: Contact | null;
}

// ============================================================================
// INTERFACES — Phase 1.2 (turf-domain tables)
// ============================================================================

export interface GolfCourseProfile {
  id: string;
  company_id: string;
  num_holes: number | null;
  total_acreage: number | null;
  course_type: CourseType | null;
  grass_types: string[] | null;
  green_grass: string | null;
  fairway_grass: string | null;
  rough_grass: string | null;
  irrigation_type: string | null;
  water_source: string | null;
  soil_type: string | null;
  microclimate_zone: string | null;
  usda_zone: string | null;
  annual_turf_budget_min: number | null;
  annual_turf_budget_max: number | null;
  maintenance_level: MaintenanceLevel | null;
  ipm_program: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  company?: Company | null;
}

export interface TurfDiseasePest {
  id: string;
  name: string;
  type: DiseasePestType;
  scientific_name: string | null;
  symptoms: string | null;
  affected_grass_types: string[] | null;
  affected_areas: string[] | null;
  season_start: string | null;
  season_end: string | null;
  optimal_temp_min_c: number | null;
  optimal_temp_max_c: number | null;
  humidity_factor: string | null;
  severity: string | null;
  cultural_controls: string | null;
  image_url: string | null;
  ontario_common: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductDiseaseLink {
  id: string;
  product_id: string;
  disease_pest_id: string;
  efficacy: EfficacyRating | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  product?: Offering | null;
  disease_pest?: TurfDiseasePest | null;
}

export interface VisitReport {
  id: string;
  activity_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  rep_id: string | null;
  visit_date: string;
  overall_condition: ConditionRating | null;
  greens_condition: ConditionRating | null;
  fairways_condition: ConditionRating | null;
  tees_condition: ConditionRating | null;
  rough_condition: ConditionRating | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  recent_rainfall_mm: number | null;
  soil_moisture: string | null;
  observations: string | null;
  recommendations: string | null;
  follow_up_actions: string | null;
  follow_up_date: string | null;
  photo_urls: string[] | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  company?: Company | null;
  contact?: Contact | null;
  rep?: UserProfile | null;
  activity?: Activity | null;
  visit_observations?: VisitObservation[];
  visit_recommendations?: VisitRecommendation[];
}

export interface VisitObservation {
  id: string;
  visit_report_id: string;
  disease_pest_id: string | null;
  severity: string | null;
  affected_area: string | null;
  area_m2_affected: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  disease_pest?: TurfDiseasePest | null;
}

export interface VisitRecommendation {
  id: string;
  visit_report_id: string;
  product_id: string | null;
  disease_pest_id: string | null;
  application_rate: number | null;
  target_area: string | null;
  priority: RecommendationPriority | null;
  was_ordered: boolean;
  deal_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  product?: Offering | null;
  disease_pest?: TurfDiseasePest | null;
  deal?: Deal | null;
}

export interface WeatherSnapshot {
  id: string;
  company_id: string;
  snapshot_date: string;
  temp_high_c: number | null;
  temp_low_c: number | null;
  temp_avg_c: number | null;
  rainfall_mm: number | null;
  humidity_avg: number | null;
  wind_avg_kmh: number | null;
  gdd_daily: number | null;
  gdd_cumulative: number | null;
  gdd_base_temp_c: number | null;
  is_spray_window: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  company?: Company | null;
}

export interface OrderDelivery {
  id: string;
  deal_id: string;
  scheduled_date: string | null;
  actual_date: string | null;
  status: DeliveryStatus;
  delivery_notes: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  deal?: Deal | null;
}

export interface TurfKnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string | null;
  symptoms: string | null;
  conditions: string | null;
  grass_types: string[] | null;
  seasonal_relevance: string[] | null;
  keywords: string[] | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AI RESPONSE SHAPES
// ============================================================================

export interface DiagnosisResult {
  confidence: number;
  identified_issue: string;
  type: DiseasePestType;
  scientific_name: string | null;
  symptoms_matched: string[];
  contributing_factors: string[];
  severity_assessment: ConditionRating;
  recommended_products: ProductRecommendation[];
  cultural_recommendations: string[];
  follow_up_timeline: string;
  requires_agronomist: boolean;
  reasoning: string;
}

export interface ProductRecommendation {
  product_id: string;
  product_name: string;
  pcp_registration_number: string | null;
  category: ProductCategory;
  application_rate: number;
  application_rate_unit: string;
  application_rate_max: number;
  target_area: string;
  mode_of_action: string | null;
  moa_group: string | null;
  efficacy: EfficacyRating;
  is_ontario_registered: boolean;
  tank_mix_compatible: boolean;
  moa_rotation_safe: boolean;
  re_entry_interval_hours: number | null;
  rain_fast_hours: number | null;
  notes: string | null;
  estimated_cost_cad: number | null;
}

export interface VisitBriefing {
  company_name: string;
  superintendent_name: string | null;
  course_profile_summary: string;
  recent_weather: {
    avg_temp_c: number | null;
    total_rainfall_mm: number | null;
    gdd_cumulative: number | null;
    is_spray_window: boolean;
  };
  active_issues: Array<{
    issue_name: string;
    type: DiseasePestType;
    severity: string;
    first_observed: string | null;
    current_status: string;
  }>;
  recent_treatments: Array<{
    product_name: string;
    application_date: string;
    target_area: string;
    moa_group: string | null;
  }>;
  upcoming_deliveries: Array<{
    deal_name: string;
    scheduled_date: string;
    status: DeliveryStatus;
  }>;
  open_recommendations: Array<{
    product_name: string;
    priority: RecommendationPriority;
    target_issue: string;
  }>;
  moa_rotation_alerts: string[];
  seasonal_risk_factors: string[];
  suggested_talking_points: string[];
}

// ============================================================================
// CONSTANTS — Phase 1.3 (Sales Intelligence Layer)
// ============================================================================

export const CALL_INPUT_TYPES = [
  'voice_dictation',
  'typed_notes',
  'call_recording_transcript',
  'visit_notes',
] as const;
export type CallInputType = (typeof CALL_INPUT_TYPES)[number];

export const PROCESSING_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const ACTION_ITEM_TYPES = [
  'send_quote',
  'schedule_visit',
  'send_sample',
  'follow_up_call',
  'check_inventory',
  'order_product',
  'other',
] as const;
export type ActionItemType = (typeof ACTION_ITEM_TYPES)[number];

export const NUDGE_TYPES = [
  'inventory_alert',
  'promo_available',
  'related_info',
  'action_reminder',
  'cross_sell',
  'disease_alert',
] as const;
export type NudgeType = (typeof NUDGE_TYPES)[number];

export const TREND_SIGNAL_TYPES = [
  'disease_outbreak',
  'product_demand_spike',
  'inventory_risk',
  'seasonal_pattern',
  'pricing_concern',
] as const;
export type TrendSignalType = (typeof TREND_SIGNAL_TYPES)[number];

export const SENTIMENT_VALUES = [
  'positive',
  'neutral',
  'concerned',
  'urgent',
] as const;
export type Sentiment = (typeof SENTIMENT_VALUES)[number];

export const NUDGE_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;
export type NudgePriority = (typeof NUDGE_PRIORITIES)[number];

export const TREND_SEVERITIES = [
  'info',
  'watch',
  'warning',
  'critical',
] as const;
export type TrendSeverity = (typeof TREND_SEVERITIES)[number];

// ============================================================================
// COLOR MAPS — Phase 1.3
// ============================================================================

export const NUDGE_TYPE_COLORS: Record<NudgeType, string> = {
  'inventory_alert': 'bg-amber-100 text-amber-700',
  'promo_available': 'bg-violet-100 text-violet-700',
  'related_info': 'bg-sky-100 text-sky-700',
  'action_reminder': 'bg-orange-100 text-orange-700',
  'cross_sell': 'bg-emerald-100 text-emerald-700',
  'disease_alert': 'bg-red-100 text-red-700',
};

export const TREND_SEVERITY_COLORS: Record<TrendSeverity, string> = {
  'info': 'bg-blue-100 text-blue-700',
  'watch': 'bg-yellow-100 text-yellow-700',
  'warning': 'bg-amber-100 text-amber-700',
  'critical': 'bg-red-100 text-red-700',
};

export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  'positive': 'bg-green-100 text-green-700',
  'neutral': 'bg-slate-100 text-slate-600',
  'concerned': 'bg-amber-100 text-amber-700',
  'urgent': 'bg-red-100 text-red-700',
};

// ============================================================================
// NESTED JSONB SHAPES — Phase 1.3
// ============================================================================

export interface ProductRequest {
  product_name: string;
  product_id: string | null;
  quantity: number | null;
  unit: string | null;
  urgency: string | null;
  notes: string | null;
}

export interface ActionItem {
  type: ActionItemType;
  description: string;
  due_date: string | null;
  company_id: string | null;
  contact_id: string | null;
  priority: NudgePriority | null;
  completed: boolean;
}

export interface TrendAction {
  action: string;
  target_companies: string[] | null;
  product_ids: string[] | null;
  priority: NudgePriority | null;
}

export interface TopDiseaseEntry {
  disease_name: string;
  mention_count: number;
  affected_regions: string[];
  trending: 'up' | 'down' | 'stable';
}

export interface TopProductEntry {
  product_name: string;
  product_id: string | null;
  request_count: number;
  revenue_potential: number | null;
}

export interface RepActivityEntry {
  rep_id: string;
  rep_name: string;
  calls_logged: number;
  follow_ups_needed: number;
  top_companies: string[];
}

// ============================================================================
// INTERFACES — Phase 1.3 (Sales Intelligence Layer)
// ============================================================================

export interface CallLog {
  id: string;
  rep_id: string;
  company_id: string | null;
  contact_id: string | null;
  activity_id: string | null;
  input_type: CallInputType;
  raw_transcript: string | null;
  duration_seconds: number | null;
  processing_status: ProcessingStatus;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  rep?: UserProfile | null;
  company?: Company | null;
  contact?: Contact | null;
  activity?: Activity | null;
  extraction?: CallLogExtraction | null;
}

export interface CallLogExtraction {
  id: string;
  call_log_id: string;
  summary: string | null;
  sentiment: Sentiment | null;
  diseases_mentioned: string[] | null;
  products_mentioned: string[] | null;
  products_requested: ProductRequest[] | null;
  competitor_mentions: string[] | null;
  budget_signals: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  action_items: ActionItem[] | null;
  key_topics: string[] | null;
  confidence_score: number | null;
  created_at: string;
  updated_at: string;
  // Optional joined relation
  call_log?: CallLog | null;
}

export interface RepNudge {
  id: string;
  rep_id: string;
  company_id: string | null;
  contact_id: string | null;
  call_log_id: string | null;
  nudge_type: NudgeType;
  priority: NudgePriority;
  title: string;
  message: string | null;
  suggested_action: string | null;
  due_date: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Optional joined relations
  rep?: UserProfile | null;
  company?: Company | null;
  contact?: Contact | null;
  call_log?: CallLog | null;
}

export interface FieldTrendSignal {
  id: string;
  signal_type: TrendSignalType;
  severity: TrendSeverity;
  title: string;
  description: string | null;
  affected_region: string | null;
  affected_companies: string[] | null;
  contributing_call_ids: string[] | null;
  data_points: number;
  first_reported_at: string | null;
  last_reported_at: string | null;
  is_active: boolean;
  resolved_at: string | null;
  recommended_actions: TrendAction[] | null;
  created_at: string;
  updated_at: string;
}

export interface DailyDigest {
  id: string;
  digest_date: string;
  total_calls_logged: number;
  total_follow_ups_needed: number;
  top_diseases: TopDiseaseEntry[] | null;
  top_products: TopProductEntry[] | null;
  rep_activity_breakdown: RepActivityEntry[] | null;
  key_highlights: string | null;
  alerts: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}
