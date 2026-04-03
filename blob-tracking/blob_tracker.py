"""
Hybrid Kalman Blob Tracker (v7: Dithering Edition)
- Uses MOG2 Background Subtraction for robust Motion Detection
- Renders "Glitching" blobs as 1-bit Black & White Dithering
- FPS updates every 0.5s for readability
- Auto-detects working camera

Usage:
  python hybrid_tracker.py       # Auto-detect camera
  python hybrid_tracker.py 1     # Force Camera Index 1
"""

import cv2
import numpy as np
import argparse
import os
import random
import time
import sys

# --- Color Palettes (BGR) ---
PALETTES = {
    '1': {'name': 'Tactical Green', 'desc': 'Classic Military HUD', 'hud': (150, 255, 150), 'net': (100, 200, 100), 'text': (200, 255, 200)},
    '2': {'name': 'Phosphor Amber', 'desc': '1980s Monochrome', 'hud': (0, 165, 255), 'net': (0, 100, 200), 'text': (0, 200, 255)},
    '3': {'name': 'Cyber Cyan', 'desc': 'Sci-Fi / Tron', 'hud': (255, 255, 0), 'net': (200, 200, 0), 'text': (255, 255, 200)},
    '4': {'name': 'Red Alert', 'desc': 'Threat Detection', 'hud': (255, 0, 0), 'net': (255, 0, 0), 'text': (150, 150, 255)},
    '5': {'name': 'Synthwave', 'desc': 'Neon Pink & Purple', 'hud': (255, 0, 255), 'net': (255, 255, 0), 'text': (200, 100, 255)},
    '6': {'name': 'Monochrome', 'desc': 'Mac Classic', 'hud': (230, 230, 230), 'net': (100, 100, 100), 'text': (255, 255, 255)}
}

# 4x4 Bayer Matrix for Ordered Dithering
# This creates the cross-hatch shading effect
BAYER_MATRIX = np.array([
    [0,  8,  2, 10],
    [12, 4, 14,  6],
    [3, 11,  1,  9],
    [15, 7, 13,  5]
], dtype=np.float32) / 16.0 * 255.0

class BlobConfig:
    def __init__(self, palette_key='1'):
        scheme = PALETTES.get(palette_key, PALETTES['1'])
        self.hud_color = scheme['hud']
        self.net_color = scheme['net']
        self.text_color = scheme['text']
        self.style_name = scheme['name']
        self.smoothing_factor = 0.6 
        self.new_connection_chance = 0.1
        self.new_glitch_chance = 0.12 # Chance a blob switches to Dithering mode
        self.connection_duration = (0, 90)
        self.glitch_duration = (0, 40) 
        self.line_thickness = 6
        self.corner_size = 0.4
        self.glow_strength = 2.0
        self.darken_background = 0.0
        self.font = cv2.FONT_HERSHEY_PLAIN
        self.font_scale_id = 2.0
        self.font_scale_coords = 1.5
        
        # Controls the size of the "pixels" in the dither effect
        # Higher = Chunkier/More retro. Lower = Finer detail.
        self.dither_scale = 3 

class NetworkState:
    def __init__(self):
        self.connections = {}
    def update(self, active_blob_ids, config):
        dead_links = []
        for pair, life in self.connections.items():
            if pair[0] not in active_blob_ids or pair[1] not in active_blob_ids:
                dead_links.append(pair)
                continue
            self.connections[pair] -= 1
            if self.connections[pair] <= 0: dead_links.append(pair)
        for d in dead_links: del self.connections[d]
        ids = list(active_blob_ids)
        if len(ids) < 2: return
        for _ in range(len(ids)):
            if random.random() < config.new_connection_chance:
                id1, id2 = random.sample(ids, 2)
                pair = tuple(sorted((id1, id2)))
                if pair not in self.connections:
                    self.connections[pair] = random.randint(*config.connection_duration)

class KalmanBlob:
    def __init__(self, blob_id, initial_center, initial_box, initial_conf):
        self.id = blob_id
        self.box = initial_box
        self.confidence = initial_conf
        self.skipped_frames = 0
        self.age = 0
        self.smooth_x = float(initial_center[0])
        self.smooth_y = float(initial_center[1])
        self.smooth_w = float(initial_box[2])
        self.smooth_h = float(initial_box[3])
        self.glitch_frames_remaining = 0
        self.kf = cv2.KalmanFilter(4, 2)
        self.kf.measurementMatrix = np.array([[1,0,0,0], [0,1,0,0]], np.float32)
        self.kf.transitionMatrix = np.array([[1,0,1,0], [0,1,0,1], [0,0,1,0], [0,0,0,1]], np.float32)
        cv2.setIdentity(self.kf.processNoiseCov, 1e-4)
        cv2.setIdentity(self.kf.measurementNoiseCov, 1e-1)
        self.kf.statePost = np.array([[initial_center[0]], [initial_center[1]], [0], [0]], dtype=np.float32)
        self.kf.errorCovPost = np.eye(4, dtype=np.float32)

    def predict(self):
        prediction = self.kf.predict()
        return int(prediction[0]), int(prediction[1])

    def correct(self, measurement, box, confidence, config):
        meas = np.array([[measurement[0]], [measurement[1]]], dtype=np.float32)
        self.kf.correct(meas)
        alpha = config.smoothing_factor
        self.smooth_x = (alpha * measurement[0]) + ((1 - alpha) * self.smooth_x)
        self.smooth_y = (alpha * measurement[1]) + ((1 - alpha) * self.smooth_y)
        self.smooth_w = (alpha * box[2]) + ((1 - alpha) * self.smooth_w)
        self.smooth_h = (alpha * box[3]) + ((1 - alpha) * self.smooth_h)
        self.box = box
        self.confidence = confidence
        self.skipped_frames = 0
        self.age += 1
        if self.glitch_frames_remaining > 0: self.glitch_frames_remaining -= 1
        else:
            if random.random() < config.new_glitch_chance:
                self.glitch_frames_remaining = random.randint(*config.glitch_duration)

    def get_render_box(self):
        cx, cy = int(self.smooth_x), int(self.smooth_y)
        w, h = int(self.smooth_w), int(self.smooth_h)
        return (cx - w//2, cy - h//2, cx + w//2, cy + h//2)

class ContourDetector:
    def __init__(self, min_area_ratio=0.003): 
        self.min_area_ratio = min_area_ratio
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=400,        
            varThreshold=100,   
            detectShadows=False 
        )
    
    def detect(self, frame):
        h, w = frame.shape[:2]
        frame_area = w * h
        min_area = frame_area * self.min_area_ratio
        max_area = frame_area * 0.90 

        fg_mask = self.bg_subtractor.apply(frame)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=1)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_DILATE, kernel, iterations=2)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        results = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area: continue

            x, y, box_w, box_h = cv2.boundingRect(cnt)
            if box_w > w * 0.95 and box_h > h * 0.95: continue

            results.append({
                'center': (x + box_w//2, y + box_h//2), 
                'box': (x, y, box_w, box_h), 
                'conf': min(1.0, area / (min_area * 50))
            })
        return results

class BlobTracker:
    def __init__(self, dist_thresh=100, max_skip=10):
        self.blobs = {}
        self.next_id = 100
        self.dist_thresh = dist_thresh
        self.max_skip = max_skip
    def update(self, detections, config):
        blob_predictions = {b_id: b.predict() for b_id, b in self.blobs.items()}
        assigned_blobs = set()
        assigned_detections = set()
        distances = []
        for b_id, (px, py) in blob_predictions.items():
            for d_idx, det in enumerate(detections):
                d = np.sqrt((px - det['center'][0])**2 + (py - det['center'][1])**2)
                if d < self.dist_thresh: distances.append((d, b_id, d_idx))
        distances.sort(key=lambda x: x[0])
        for d, b_id, d_idx in distances:
            if b_id not in assigned_blobs and d_idx not in assigned_detections:
                self.blobs[b_id].correct(detections[d_idx]['center'], detections[d_idx]['box'], detections[d_idx]['conf'], config)
                assigned_blobs.add(b_id); assigned_detections.add(d_idx)
        for b_id in list(self.blobs.keys()):
            if b_id not in assigned_blobs:
                self.blobs[b_id].skipped_frames += 1
                if self.blobs[b_id].skipped_frames > self.max_skip: del self.blobs[b_id]
        for d_idx in range(len(detections)):
            if d_idx not in assigned_detections:
                new_blob = KalmanBlob(self.next_id, detections[d_idx]['center'], detections[d_idx]['box'], detections[d_idx]['conf'])
                self.blobs[self.next_id] = new_blob; self.next_id += 1
        return self.blobs

def dim_color(color, opacity): return tuple(int(c * opacity) for c in color)

def render_dither_block(frame, x1, y1, x2, y2, roi, config):
    """
    Overlays a Black & White Ordered Dither (Bayer) effect on the ROI.
    """
    roi_h, roi_w = roi.shape[:2]
    scale = config.dither_scale

    # 1. Downscale to create the "pixelated" look
    small_w = roi_w // scale
    small_h = roi_h // scale

    if small_w <= 0 or small_h <= 0: return

    # Resize down
    small_roi = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
    
    # 2. Convert to Grayscale
    gray = cv2.cvtColor(small_roi, cv2.COLOR_BGR2GRAY)

    # 3. Create the Dither Threshold Map
    # Tile the Bayer Matrix to cover the whole image
    rep_y = (small_h // 4) + 1
    rep_x = (small_w // 4) + 1
    
    # Create threshold map and slice to exact size
    threshold_map = np.tile(BAYER_MATRIX, (rep_y, rep_x))[:small_h, :small_w]
    
    # 4. Compare pixels to threshold (The Logic: if Pixel > Threshold -> White, else Black)
    # Using strict B&W (0 or 255)
    mask = gray > threshold_map
    binary = np.zeros_like(gray)
    binary[mask] = 255
    
    # 5. Upscale back to original ROI size
    # Use Nearest Neighbor to keep the sharp "pixelated" edges
    dithered = cv2.resize(binary, (roi_w, roi_h), interpolation=cv2.INTER_NEAREST)
    
    # 6. Convert to BGR to overlay onto main frame
    dithered_bgr = cv2.cvtColor(dithered, cv2.COLOR_GRAY2BGR)
    
    # Apply to frame
    # We clip coordinates just in case resizing created a slight 1px mismatch
    h_d, w_d = dithered_bgr.shape[:2]
    
    # Ensure overlay fits in target bounds (handle edge cases)
    target_h = y2 - y1
    target_w = x2 - x1
    
    if h_d != target_h or w_d != target_w:
         dithered_bgr = cv2.resize(dithered_bgr, (target_w, target_h), interpolation=cv2.INTER_NEAREST)

    frame[y1:y2, x1:x2] = dithered_bgr

def draw_hud(frame, blobs, network_state, config):
    h, w = frame.shape[:2]
    if config.darken_background > 0.01:
        bg = cv2.addWeighted(frame, 1.0 - config.darken_background, np.zeros_like(frame), 0, 0)
    else:
        bg = frame # Zero cost reference
        
    active_ids = {b_id for b_id, b in blobs.items() if b.age >= 2}
    network_state.update(active_ids, config)
    
    # -- DITHER RENDERING LAYER --
    # We modify 'bg' in place with the dither effect
    for b_id in active_ids:
        blob = blobs[b_id]
        if blob.glitch_frames_remaining > 0:
            x1, y1, x2, y2 = blob.get_render_box()
            x1, y1 = max(0, x1), max(0, y1); x2, y2 = min(w, x2), min(h, y2)
            roi = bg[y1:y2, x1:x2]
            if roi.size > 0:
                render_dither_block(bg, x1, y1, x2, y2, roi, config)

    # -- HUD LAYER --
    hud = np.zeros_like(frame)
    
    # Network lines
    for (id1, id2), life in network_state.connections.items():
        if id1 in blobs and id2 in blobs:
            p1 = (int(blobs[id1].smooth_x), int(blobs[id1].smooth_y))
            p2 = (int(blobs[id2].smooth_x), int(blobs[id2].smooth_y))
            cv2.line(hud, p1, p2, dim_color(config.net_color, min(1.0, life/10.0)), 1, cv2.LINE_AA)
            
    # Bounding Corners & Text
    for b_id in active_ids:
        b = blobs[b_id]
        op = max(0.6, min(1.0, b.confidence)) * (0.5 if b.skipped_frames > 0 else 1.0)
        hud_c, txt_c = dim_color(config.hud_color, op), dim_color(config.text_color, op)
        x1, y1, x2, y2 = b.get_render_box()
        cx, cy = int(b.smooth_x), int(b.smooth_y)
        clx, cly = int((x2-x1)*config.corner_size), int((y2-y1)*config.corner_size)
        
        # Draw Corners
        for p1, p2 in [((x1,y1),(x1+clx,y1)),((x1,y1),(x1,y1+cly)),((x2,y1),(x2-clx,y1)),((x2,y1),(x2,y1+cly)),((x1,y2),(x1+clx,y2)),((x1,y2),(x1,y2-cly)),((x2,y2),(x2-clx,y2)),((x2,y2),(x2,y2-cly))]:
            cv2.line(hud, p1, p2, hud_c, config.line_thickness)
        
        # ID and Coords
        cv2.putText(hud, f"ID:{b.id:03}", (x1, y1-10), config.font, config.font_scale_id, txt_c, 1)
        cv2.putText(hud, f"{cx},{cy}", (x1, y2+25), config.font, config.font_scale_coords, txt_c, 1)
        
    # Optimization: Downscale, blur, upscale.
    small_hud = cv2.resize(hud, (0, 0), fx=0.25, fy=0.25)
    blurred_small = cv2.GaussianBlur(small_hud, (13, 13), 0)
    blurred_hud = cv2.resize(blurred_small, (hud.shape[1], hud.shape[0]))
    
    return cv2.add(bg, cv2.addWeighted(hud, 1.0, blurred_hud, config.glow_strength, 0))

def get_user_palette():
    print("\n" + "="*50)
    print("🎨 HUD STYLE SELECTOR")
    print("="*50)
    for key, data in PALETTES.items(): print(f"  {key}. {data['name']:<16} | {data['desc']}")
    print("-" * 50)
    c = input("Select a style (1-6) [default: 1]: ").strip()
    return c if c in PALETTES else '1'

def find_working_camera(preferred_index=None):
    indices_to_try = [preferred_index] if preferred_index is not None else [0, 1, 2]
    print("\n🔍 Scanning for cameras...")
    for idx in indices_to_try:
        print(f"   Trying Index {idx}...", end="", flush=True)
        if sys.platform == "darwin": cap = cv2.VideoCapture(idx, cv2.CAP_AVFOUNDATION)
        else: cap = cv2.VideoCapture(idx)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 600)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 600)
        if not cap.isOpened():
            print(" Failed.")
            continue
        ret, frame = cap.read()
        if ret and frame is not None and frame.size > 0:
            print(" Success! ✅")
            return cap, idx
        else:
            print(" No frame.")
            cap.release()
    return None, None

def scan_and_select_camera():
    print("\n" + "="*50)
    print("🔍 SCANNING FOR CAMERAS...")
    print("="*50)
    
    available_indices = []
    
    # Scan first 5 indices (0-4)
    for i in range(5):
        print(f"   Testing Index {i}...", end="", flush=True)
        
        # Platform specific backend
        if sys.platform == "darwin": 
            cap = cv2.VideoCapture(i, cv2.CAP_AVFOUNDATION)
        else: 
            cap = cv2.VideoCapture(i)
            
        if cap.isOpened():
            # Try to read a frame to ensure it actually works
            ret, _ = cap.read()
            if ret:
                print(" OK! ✅")
                available_indices.append(i)
            else:
                print(" Locked/No Signal. ❌")
        else:
            print(" Not found.")
        cap.release()

    if not available_indices:
        print("\n❌ No cameras found.")
        return None

    print("-" * 50)
    print("📸 AVAILABLE CAMERAS:")
    for idx in available_indices:
        print(f"  [{idx}] Camera Index {idx}")
    print("-" * 50)

    while True:
        choice = input(f"Select Camera Index ({', '.join(map(str, available_indices))}) or 'q' to quit: ").strip()
        if choice.lower() == 'q':
            sys.exit()
        if choice.isdigit() and int(choice) in available_indices:
            return choice # Return as string to fit existing logic
        print("Invalid selection. Try again.")

def process_video(input_path, output_path, config, max_frames=None, show_preview=True):
    is_webcam = False
    cap = None
    
    if input_path == 'auto':
        cap, index = find_working_camera()
        is_webcam = True
    elif str(input_path).isdigit():
        cap, index = find_working_camera(int(input_path))
        is_webcam = True
    else:
        cap = cv2.VideoCapture(input_path)
        index = input_path

    if cap is None:
        print("\n❌ CRITICAL ERROR: No video source found.")
        return

    print(f"\n🚀 System Online. Using Source: {index}")
    
    detector = ContourDetector()
    tracker = BlobTracker(dist_thresh=120, max_skip=15)
    network = NetworkState()
    
    writer = None
    if output_path:
        w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps_in = cap.get(cv2.CAP_PROP_FPS); fps_in = 30 if fps_in <= 0 else fps_in
        writer = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), int(fps_in), (w, h))

    frame_idx = 0
    prev_time = time.time()
    
    # FPS Smoothing variables
    fps_display = 0
    fps_update_interval = 0.5 # Update every 0.5 seconds
    last_fps_update = time.time()
    
    try:
        while True:
            # FPS Calculation
            curr_time = time.time()
            dt = curr_time - prev_time
            prev_time = curr_time
            
            # Only update the number string periodically
            if curr_time - last_fps_update > fps_update_interval:
                instant_fps = 1.0 / dt if dt > 0 else 0
                fps_display = int(instant_fps)
                last_fps_update = curr_time
            
            ret, frame = cap.read()
            if not ret:
                if is_webcam: continue 
                else: break

            if max_frames and frame_idx >= max_frames: break
            if is_webcam: frame = cv2.flip(frame, 1)

            detections = detector.detect(frame)
            active_blobs = tracker.update(detections, config)
            final_frame = draw_hud(frame, active_blobs, network, config)

            if is_webcam:
                blink = int(time.time() * 2) % 2
                col = (0, 0, 255) if blink else (0, 0, 100)
                cv2.putText(final_frame, "LIVE", (20, 40), config.font, 1.2, col, 2)
            
            cv2.putText(final_frame, f"FPS:{fps_display}", (20, 70), config.font, 1.0, config.text_color, 1)

            if writer: writer.write(final_frame)
            
            if show_preview:
                cv2.imshow(f"Tracker | {config.style_name}", final_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'): break
            
            frame_idx += 1
            
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if writer: writer.release()
        cv2.destroyAllWindows()
        print("\n✅ Session Ended.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('input', nargs='?', default='auto', help='Video file or "auto"')
    parser.add_argument('--output', '-o', help='Output video file')
    parser.add_argument('--no-preview', action='store_true')
    parser.add_argument('--max-frames', type=int, default=None)
    parser.add_argument('--no-interactive', action='store_true')
    args = parser.parse_args()
    
    if args.input == 'auto' and not args.no_interactive:
        selected_cam = scan_and_select_camera()
        if selected_cam:
            args.input = selected_cam
        else:
            print("No camera selected. Exiting.")
            sys.exit()

    if args.output is None and args.input != 'auto' and not args.input.isdigit():
        filename, ext = os.path.splitext(args.input)
        args.output = f"{filename}_tracked.mp4"
        print(f"📁 Input file detected. Auto-saving output to: {args.output}")
        
    palette = '1'
    if not args.no_interactive: 
        palette = get_user_palette()
        
    process_video(args.input, args.output, BlobConfig(palette), args.max_frames, not args.no_preview)