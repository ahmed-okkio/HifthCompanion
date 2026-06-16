export interface AnnotationSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Annotation {
  id: string;
  set_id: string;
  page_number: number;
  canvas_json: any; // Using any for Fabric.js JSON object
  updated_at: string;
}
