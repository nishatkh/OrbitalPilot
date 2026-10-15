"""
Rocket-AI · Cinematic Lunar Lander Dashboard
=============================================
Custom-rendered environment: real-looking rocket, engine flames,
particle exhaust, starfield, moon terrain, craters, landing pad lights.
Side panel: live score, telemetry gauges, training curve, model comparison.
"""

import csv, math, os, random, time
import numpy as np
import pygame
import gymnasium as gym
from stable_baselines3 import PPO

# ── Init ──────────────────────────────────────────────────────────────────────
pygame.init()
WIN_W, WIN_H = 1440, 900
ENV_W, ENV_H = 800, 900        # full-height env pane
PANEL_X      = ENV_W
PANEL_W      = WIN_W - ENV_W
FPS          = 60

screen = pygame.display.set_mode((WIN_W, WIN_H))
pygame.display.set_caption("Rocket-AI  ·  Lunar Lander")
clock  = pygame.time.Clock()

def mf(size, bold=False):
    for n in ["Helvetica Neue","Arial","DejaVu Sans"]:
        f = pygame.font.SysFont(n, size, bold=bold)
        if f: return f
    return pygame.font.SysFont(None, size, bold=bold)

F_XL = mf(32, True); F_LG = mf(22, True); F_MD = mf(16, True)
F_SM = mf(13);        F_XS = mf(11)

# ── Palette ───────────────────────────────────────────────────────────────────
BG       = ( 4,   6,  14)
SPACE    = ( 8,  10,  22)
PANEL_BG = (12,  16,  30)
BORDER   = (30,  38,  70)
ACCENT   = (70, 160, 255)
MINT     = (100, 255, 180)
AMBER    = (255, 185,  50)
RED      = (255,  70,  70)
TEXT     = (210, 220, 255)
DIM      = ( 90, 105, 150)
WHITE    = (255, 255, 255)
GOLD     = (255, 210,  60)

MODEL_COL = {"lander":(70,160,255),"baseline":(100,255,180),
             "shaped":(255,185,50),"hover":(255,70,70)}
ALL_MODELS = ["lander","baseline","shaped","hover"]

# ── Coordinate helpers ────────────────────────────────────────────────────────
# Observation: x in [-1.5,1.5], y in [0,1.5] (0=ground level)
GROUND_Y   = int(ENV_H * 0.78)   # y pixel of moon surface centre
PAD_CX     = ENV_W // 2          # landing pad centre x
SCALE_X    = ENV_W * 0.30        # obs units to pixels
SCALE_Y    = ENV_H * 0.38
ROCKET_H   = 52                  # half-height from centre to tip
ROCKET_W   = 18                  # half-width
FEET_OFFSET = ROCKET_H + 30      # 82 px from rocket centre to leg tips
PAD_SURFACE_Y = GROUND_Y - 4

def obs_to_px(ox, oy, angle=0.0):
    px = PAD_CX + int(ox * SCALE_X)
    # Account for landing legs and tilt so craft rests cleanly on the pad surface without sinking
    tilt_drop = max(FEET_OFFSET, abs(39.6 * math.sin(angle)) + FEET_OFFSET * math.cos(angle))
    py = PAD_SURFACE_Y - int(tilt_drop) - int(max(0.0, oy) * SCALE_Y)
    return px, py

# ── Stars ─────────────────────────────────────────────────────────────────────
random.seed(42)
STARS = [(random.randint(0,WIN_W), random.randint(0,int(GROUND_Y*0.7)),
          random.random()) for _ in range(340)]
STAR_TWINKLE = [random.random()*6.28 for _ in STARS]

def draw_stars(t):
    for i,(sx,sy,br) in enumerate(STARS):
        phase = math.sin(t*1.2 + STAR_TWINKLE[i])
        a = int(180 + 75*br*phase)
        a = max(60, min(255, a))
        r = 1 if br < 0.5 else 2
        pygame.draw.circle(screen, (a,a,min(255,a+40)), (sx,sy), r)

# ── Moon terrain ──────────────────────────────────────────────────────────────
random.seed(7)
def build_terrain():
    pts = []
    # left edge
    pts.append((0, GROUND_Y + random.randint(20,60)))
    x = 0
    while x < ENV_W:
        step = random.randint(18, 55)
        x += step
        # flatten near pad
        if abs(x - PAD_CX) < 120:
            y = GROUND_Y
        else:
            y = GROUND_Y + random.randint(-12, 38)
        pts.append((min(x,ENV_W), y))
    pts.append((ENV_W, GROUND_Y + random.randint(20,60)))
    pts.append((ENV_W, ENV_H))
    pts.append((0, ENV_H))
    return pts

TERRAIN_PTS = build_terrain()
TERRAIN_COL  = (38,  40,  55)
TERRAIN_COL2 = (52,  55,  75)   # highlight

# Craters
CRATERS = []
for _ in range(9):
    cx = random.randint(60, ENV_W-60)
    # avoid pad area
    if abs(cx - PAD_CX) < 110: continue
    cy = GROUND_Y + random.randint(5,30)
    cr = random.randint(8,28)
    CRATERS.append((cx,cy,cr))

def draw_terrain():
    pygame.draw.polygon(screen, TERRAIN_COL, TERRAIN_PTS)
    # surface highlight line
    surface_pts = [(p[0],p[1]) for p in TERRAIN_PTS[:-2]]
    if len(surface_pts) >= 2:
        pygame.draw.lines(screen, TERRAIN_COL2, False, surface_pts, 2)
    # craters
    for cx,cy,cr in CRATERS:
        pygame.draw.ellipse(screen, (28,30,44), (cx-cr,cy-cr//3,cr*2,cr//2*2))
        pygame.draw.ellipse(screen, (55,58,78), (cx-cr,cy-cr//3,cr*2,cr//2*2), 1)

# Landing pad
PAD_W = 100
def draw_pad(t):
    py = GROUND_Y
    # pad surface
    pygame.draw.rect(screen, (55,65,100), (PAD_CX-PAD_W//2-2, py-4, PAD_W+4, 8), border_radius=3)
    # lights
    for i in range(7):
        lx = PAD_CX - PAD_W//2 + i*(PAD_W//6)
        pulse = 0.5 + 0.5*math.sin(t*4 + i*0.9)
        c = (int(50+205*pulse), int(150+105*pulse), 255)
        pygame.draw.circle(screen, c, (lx, py-6), 4)
        # glow
        gsurf = pygame.Surface((20,20), pygame.SRCALPHA)
        pygame.draw.circle(gsurf, (*c, int(60*pulse)), (10,10), 10)
        screen.blit(gsurf, (lx-10, py-16))
    # flag poles
    for side in [-1,1]:
        fx = PAD_CX + side*(PAD_W//2+10)
        pygame.draw.line(screen, (180,180,200), (fx,py-4),(fx,py-36), 2)
        flag_col = (200,60,60) if side == -1 else (60,160,255)
        pygame.draw.rect(screen, flag_col, (fx, py-36, 16, 10))

# ── Particle system ───────────────────────────────────────────────────────────
class Particle:
    __slots__ = ["x","y","vx","vy","life","max_life","r","col"]
    def __init__(self,x,y,vx,vy,life,r,col):
        self.x,self.y,self.vx,self.vy = x,y,vx,vy
        self.life=self.max_life=life
        self.r=r; self.col=col
    def update(self,dt):
        self.x+=self.vx*dt; self.y+=self.vy*dt
        self.vy+=80*dt   # gravity
        self.life-=dt
        return self.life>0
    def draw(self,surf):
        a = self.life/self.max_life
        r = max(1,int(self.r*a))
        col = (int(self.col[0]),int(self.col[1]),int(self.col[2]))
        if r < 2:
            pygame.draw.circle(surf, col, (int(self.x),int(self.y)), 1)
        else:
            s = pygame.Surface((r*2+2,r*2+2), pygame.SRCALPHA)
            pygame.draw.circle(s, (*col, int(220*a)), (r+1,r+1), r)
            surf.blit(s, (int(self.x)-r-1, int(self.y)-r-1))

particles = []

def emit_main_engine(rx,ry,angle,strength=1.0):
    # Main engine shoots downward (relative to rocket angle)
    for _ in range(int(8*strength)):
        spread = random.uniform(-0.4,0.4)
        spd    = random.uniform(60,200)*strength
        # engine nozzle is below rocket centre, pointing "down" in rocket frame
        nozzle_angle = angle + math.pi/2 + spread
        vx = math.cos(nozzle_angle)*spd + random.uniform(-15,15)
        vy = math.sin(nozzle_angle)*spd + random.uniform(-15,15)
        # colour: white core → orange → red → smoke
        stage = random.random()
        if stage < 0.2:
            col = (255,255,220)
        elif stage < 0.5:
            col = (255,200,80)
        elif stage < 0.8:
            col = (255,100,30)
        else:
            col = (120,120,130)
        life = random.uniform(0.2,0.6)
        r    = random.uniform(3,8)*strength
        # offset to nozzle tip
        ox = rx + math.cos(angle+math.pi/2)*28
        oy = ry + math.sin(angle+math.pi/2)*28
        particles.append(Particle(ox,oy,vx,vy,life,r,col))

def emit_side_engine(rx,ry,angle,side):
    # side thrusters puff perpendicular
    for _ in range(4):
        perp = angle + (math.pi/2 if side>0 else -math.pi/2)
        spd  = random.uniform(30,90)
        vx   = math.cos(perp)*spd + random.uniform(-10,10)
        vy   = math.sin(perp)*spd + random.uniform(-10,10)
        col  = random.choice([(255,200,80),(255,140,40),(200,100,20)])
        ox   = rx + math.cos(angle)*(side*18)
        oy   = ry + math.sin(angle)*(side*18)
        particles.append(Particle(ox,oy,vx,vy,random.uniform(0.1,0.3),
                                  random.uniform(2,5),col))

def emit_dust(px,py,intensity=1.0):
    for _ in range(int(5*intensity)):
        vx = random.uniform(-40,40)
        vy = random.uniform(-25,5)
        particles.append(Particle(px+random.uniform(-20,20),py,
                                  vx,vy,random.uniform(0.3,0.8),
                                  random.uniform(2,6),(180,170,160)))

def emit_explosion(px,py):
    for _ in range(120):
        angle = random.uniform(0,math.pi*2)
        spd   = random.uniform(20,300)
        col   = random.choice([(255,255,100),(255,180,40),(255,80,20),
                               (200,200,200),(255,255,255)])
        life  = random.uniform(0.3,1.2)
        particles.append(Particle(px,py,
                                  math.cos(angle)*spd,math.sin(angle)*spd,
                                  life,random.uniform(3,12),col))

def emit_success(px,py):
    for _ in range(80):
        angle = random.uniform(-math.pi,0)
        spd   = random.uniform(30,150)
        col   = random.choice([(100,255,180),(80,200,255),(255,220,60),(255,255,255)])
        life  = random.uniform(0.5,1.5)
        particles.append(Particle(px,py,
                                  math.cos(angle)*spd,math.sin(angle)*spd,
                                  life,random.uniform(2,8),col))

# ── Rocket drawing ────────────────────────────────────────────────────────────
ROCKET_H = 52   # half-height from centre to tip
ROCKET_W = 18   # half-width

def draw_rocket(surf, cx, cy, angle, action, ll, rl, t):
    """Draw a detailed lander craft centred at (cx,cy), rotated by angle."""
    cos_a, sin_a = math.cos(angle), math.sin(angle)

    def rot(dx,dy):
        return (cx + dx*cos_a - dy*sin_a,
                cy + dx*sin_a + dy*cos_a)

    # ── Body (capsule shape via polygon) ──
    body_pts = [
        rot(-ROCKET_W,  ROCKET_H),   # bottom-left
        rot(-ROCKET_W*0.6, -ROCKET_H*0.3),
        rot(-ROCKET_W*0.3, -ROCKET_H*0.7),
        rot(0,          -ROCKET_H),   # nose tip
        rot( ROCKET_W*0.3,-ROCKET_H*0.7),
        rot( ROCKET_W*0.6,-ROCKET_H*0.3),
        rot( ROCKET_W,   ROCKET_H),   # bottom-right
    ]
    pygame.draw.polygon(surf, (200,210,230), body_pts)
    pygame.draw.polygon(surf, (160,170,200), body_pts, 1)

    # ── Nose cone (darker) ──
    nose_pts = [
        rot(-ROCKET_W*0.3,-ROCKET_H*0.7),
        rot(0, -ROCKET_H),
        rot( ROCKET_W*0.3,-ROCKET_H*0.7),
    ]
    pygame.draw.polygon(surf, (140,150,180), nose_pts)

    # ── Window ──
    win_cx,win_cy = rot(0,-ROCKET_H*0.25)
    pygame.draw.circle(surf, (60,180,255), (int(win_cx),int(win_cy)), 8)
    pygame.draw.circle(surf, (200,240,255), (int(win_cx)-2,int(win_cy)-2), 3)
    pygame.draw.circle(surf, (80,200,255), (int(win_cx),int(win_cy)), 8, 1)

    # ── Engine nozzle bell ──
    bell_pts = [
        rot(-ROCKET_W*0.5, ROCKET_H),
        rot(-ROCKET_W*0.7, ROCKET_H+14),
        rot( ROCKET_W*0.7, ROCKET_H+14),
        rot( ROCKET_W*0.5, ROCKET_H),
    ]
    pygame.draw.polygon(surf, (80,85,110), bell_pts)
    pygame.draw.polygon(surf, (100,110,140), bell_pts, 1)

    # ── Fins ──
    for side in [-1, 1]:
        fin_pts = [
            rot(side*ROCKET_W,    ROCKET_H*0.4),
            rot(side*ROCKET_W*2,  ROCKET_H*0.9),
            rot(side*ROCKET_W*2,  ROCKET_H),
            rot(side*ROCKET_W,    ROCKET_H),
        ]
        pygame.draw.polygon(surf, (120,130,165), fin_pts)
        pygame.draw.polygon(surf, (80,90,130), fin_pts, 1)

    # ── Landing legs ──
    for side in [-1, 1]:
        leg_up   = (rot(side*ROCKET_W*0.8, ROCKET_H*0.7),
                    rot(side*ROCKET_W*1.8, ROCKET_H+22))
        leg_down = (rot(side*ROCKET_W*1.8, ROCKET_H+22),
                    rot(side*ROCKET_W*2.2, ROCKET_H+30))
        leg_col  = (MINT[0], MINT[1], MINT[2]) if (ll if side<0 else rl) else (160,165,195)
        pygame.draw.line(surf, leg_col, (int(leg_up[0][0]),int(leg_up[0][1])),
                         (int(leg_up[1][0]),int(leg_up[1][1])), 3)
        pygame.draw.line(surf, leg_col, (int(leg_down[0][0]),int(leg_down[0][1])),
                         (int(leg_down[1][0]),int(leg_down[1][1])), 2)

    # ── Main engine glow ──
    if action == 2:
        glow_x, glow_y = rot(0, ROCKET_H+14)
        gs = pygame.Surface((60,60), pygame.SRCALPHA)
        flicker = 0.7 + 0.3*math.sin(t*40)
        pygame.draw.circle(gs, (255,200,80, int(130*flicker)), (30,30), int(28*flicker))
        pygame.draw.circle(gs, (255,255,200, int(180*flicker)), (30,30), int(14*flicker))
        surf.blit(gs, (int(glow_x)-30, int(glow_y)-30))

    # ── Side thruster glow ──
    if action in (1, 3):
        side = 1 if action == 3 else -1
        tx,ty = rot(side*ROCKET_W*0.8, ROCKET_H*0.15)
        gs = pygame.Surface((30,30), pygame.SRCALPHA)
        pygame.draw.circle(gs,(255,160,40,160),(15,15),12)
        surf.blit(gs,(int(tx)-15,int(ty)-15))

# ── Ambient glow overlay for space ───────────────────────────────────────────
def draw_space_bg(t):
    # Deep space gradient (pre-drawn rect blend)
    screen.fill(BG, (0,0,ENV_W,ENV_H))
    # Nebula hints
    for nb in [(120,200,180,90),(ENV_W-150,130,220,110),(ENV_W//2,80,300,160)]:
        nx,ny,nw,nh = nb
        ns = pygame.Surface((nw,nh), pygame.SRCALPHA)
        pulse = 0.5+0.5*math.sin(t*0.3+nx)
        pygame.draw.ellipse(ns,(30,40,80,int(35*pulse)),(0,0,nw,nh))
        screen.blit(ns,(nx-nw//2,ny-nh//2))

# ── Training curve data ───────────────────────────────────────────────────────
def load_log(path="logs/training.csv.monitor.csv"):
    R, T = [], []
    if not os.path.exists(path): return R, T
    with open(path) as f:
        for l in f:
            if l.startswith("#"): continue
            break
        ts=0
        for row in csv.DictReader(f, fieldnames=["r","l","t"]):
            try:
                ts+=int(row["l"]); R.append(float(row["r"])); T.append(ts)
            except: pass
    return R, T

def smooth(v,w=30):
    out=[]
    for i in range(len(v)):
        s=max(0,i-w+1)
        out.append(sum(v[s:i+1])/(i-s+1))
    return out

TRAIN_R, TRAIN_T = load_log()
SMOOTH_R = smooth(TRAIN_R,30)

# ── Quick eval ────────────────────────────────────────────────────────────────
def quick_eval(name,n=12):
    p=f"models/ppo_{name}.zip"
    if not os.path.exists(p): return []
    m=PPO.load(p); ev=gym.make("LunarLander-v3"); sc=[]
    for ep in range(n):
        obs,_=ev.reset(seed=500+ep); tot=0.0
        for _ in range(1000):
            a,_=m.predict(obs,deterministic=True)
            obs,r,d,tr,_=ev.step(a); tot+=float(r)
            if d or tr: break
        sc.append(tot)
    ev.close(); return sc

print("Evaluating models...")
EVAL={}
for mn in ALL_MODELS:
    sc=quick_eval(mn,12); EVAL[mn]=sc
    print(f"  {mn:10s}  {'mean='+str(round(np.mean(sc),1)) if sc else '(not found)'}")
print("Done.\n")

# ── Dashboard state ───────────────────────────────────────────────────────────
class DS:
    model     = "lander"
    ep        = 0
    step      = 0
    reward    = 0.0
    history   = []
    streak    = 0
    best      = None
    obs       = np.zeros(8)
    action    = 0
    ep_start  = time.time()
    buttons   = []
    crashed   = False
    landed    = False
    event_t   = 0.0   # time of last event for flash effects

ds = DS()

# ── Panel helpers ─────────────────────────────────────────────────────────────
def txt(s,x,y,f=F_SM,c=TEXT,anchor="topleft"):
    surf=f.render(str(s),True,c)
    r=surf.get_rect(**{anchor:(x,y)})
    screen.blit(surf,r); return r

def rrect(rect,col,rad=8,a=None):
    if a is not None:
        t=pygame.Surface((rect[2],rect[3]),pygame.SRCALPHA)
        pygame.draw.rect(t,(*col,a),(0,0,rect[2],rect[3]),border_radius=rad)
        screen.blit(t,(rect[0],rect[1]))
    else:
        pygame.draw.rect(screen,col,rect,border_radius=rad)

def border(rect,col=ACCENT,w=1,rad=8):
    pygame.draw.rect(screen,col,rect,width=w,border_radius=rad)

# ── Panel sections ────────────────────────────────────────────────────────────
def draw_panel_bg():
    # Deep panel background
    pygame.draw.rect(screen, PANEL_BG, (PANEL_X, 0, PANEL_W, WIN_H))
    for x2 in range(PANEL_X, WIN_W, 30):
        pygame.draw.line(screen,(18,22,40),(x2,0),(x2,WIN_H),1)
    for y2 in range(0, WIN_H, 30):
        pygame.draw.line(screen,(18,22,40),(PANEL_X,y2),(WIN_W,y2),1)
    pygame.draw.line(screen, ACCENT, (PANEL_X,0),(PANEL_X,WIN_H),2)

def draw_header():
    txt("ROCKET-AI", PANEL_X+16, 10, F_XL, ACCENT)
    txt("LUNAR LANDER  ·  PPO  ·  LunarLander-v3", PANEL_X+16, 46, F_XS, DIM)
    pygame.draw.line(screen,BORDER,(PANEL_X+10,66),(WIN_W-10,66),1)

def draw_score_card(y0=72):
    x0,w,h = PANEL_X+10, PANEL_W-20, 72
    rrect((x0,y0,w,h), PANEL_BG, rad=10, a=230)
    border((x0,y0,w,h), ACCENT, rad=10)
    sc = ds.reward
    sc_col = MINT if sc>=200 else (ACCENT if sc>=0 else RED)
    txt(f"{sc:+.2f}", x0+w//2, y0+8, F_XL, sc_col, "midtop")
    txt("LIVE EPISODE SCORE", x0+w//2, y0+50, F_XS, DIM, "midtop")
    elapsed=time.time()-ds.ep_start
    txt(f"Ep {ds.ep}  |  Step {ds.step}  |  {elapsed:.1f}s",
        x0+8, y0+52, F_XS, DIM)
    if ds.best is not None:
        txt(f"BEST {ds.best:.1f}", x0+w-8, y0+52, F_XS, GOLD, "topright")

def draw_telemetry(y0):
    x,y,vx,vy,ang,ow,ll,rl = ds.obs
    labs=["X POS","ALTITUDE","VEL X","VEL Y","ANGLE","ANG VEL"]
    vals=[x,y,vx,vy,ang,ow]; rngs=[1.5,1.5,3,3,1.5,3]
    cols=[ACCENT,MINT,AMBER,AMBER,ACCENT,ACCENT]
    px=PANEL_X+10; cw=(PANEL_W-20)//3; ch=55
    txt("TELEMETRY", px, y0, F_XS, DIM); y0+=16
    for i,(lab,val,rng,col) in enumerate(zip(labs,vals,rngs,cols)):
        row,col_i = i//3, i%3
        cx2=px+col_i*cw; cy2=y0+row*(ch+3)
        rrect((cx2,cy2,cw-3,ch),PANEL_BG,rad=6,a=220)
        border((cx2,cy2,cw-3,ch),BORDER,rad=6)
        txt(lab, cx2+5, cy2+3, F_XS, DIM)
        vc = col if abs(val)<rng*0.75 else RED
        txt(f"{val:+.3f}", cx2+(cw-3)//2, cy2+16, F_MD, vc, "midtop")
        bx,bg_y,bw,bh2 = cx2+5, cy2+ch-13, cw-15, 6
        pygame.draw.rect(screen,BORDER,(bx,bg_y,bw,bh2),border_radius=3)
        norm=max(0.0,min(1.0,(val/rng+1)/2))
        fi=int(norm*bw)
        if fi>0: pygame.draw.rect(screen,vc,(bx,bg_y,fi,bh2),border_radius=3)
        pygame.draw.line(screen,DIM,(bx+bw//2,bg_y),(bx+bw//2,bg_y+bh2),1)
    ly = y0+2*(ch+3)+4
    action_n=["OFF","LEFT","MAIN","RIGHT"][int(ds.action)]
    txt(f"LEGS  L:{'■' if ll else '□'}  R:{'■' if rl else '□'}",px,ly,F_SM,MINT if(ll and rl) else DIM)
    txt(f"ENGINE  {action_n}", px+160, ly, F_SM, AMBER if ds.action!=0 else DIM)
    return ly+22

def draw_model_selector(y0):
    px=PANEL_X+10; bw=(PANEL_W-20)//4-3
    txt("AGENT SELECTOR", px, y0, F_XS, DIM); y0+=16
    ds.buttons.clear()
    for i,name in enumerate(ALL_MODELS):
        bx=px+i*(bw+3)
        col=MODEL_COL[name]; act=(name==ds.model)
        rrect((bx,y0,bw,32), col if act else PANEL_BG, rad=6, a=235)
        border((bx,y0,bw,32), col, rad=6)
        tc = BG if act else col
        txt(name.upper(), bx+bw//2, y0+16, F_XS, tc, "center")
        if EVAL.get(name):
            mv=np.mean(EVAL[name])
            txt(f"{mv:.0f}", bx+bw//2, y0+34, F_XS, col, "midtop")
        ds.buttons.append((pygame.Rect(bx,y0,bw,32),name))
    return y0+52

def draw_history(y0, h=80):
    px=PANEL_X+10; w=PANEL_W-20
    txt("EPISODE HISTORY", px, y0, F_XS, DIM); y0+=16
    rrect((px,y0,w,h),PANEL_BG,rad=6,a=220)
    border((px,y0,w,h),BORDER,rad=6)
    hist=ds.history[-35:]
    if hist:
        lo=min(min(hist),-100); hi=max(max(hist),300)
        n=len(hist); bw2=max(2,(w-10)//(n)-1)
        for j,sc in enumerate(hist):
            norm=(sc-lo)/(hi-lo+1e-9)
            bh=max(1,int(norm*(h-10)))
            bx2=px+5+j*(bw2+1); by=y0+h-5-bh
            col=MINT if sc>=200 else (AMBER if sc>=0 else RED)
            pygame.draw.rect(screen,col,(bx2,by,bw2,bh),border_radius=1)
        n200=(200-lo)/(hi-lo+1e-9)
        ly2=y0+h-5-int(n200*(h-10))
        pygame.draw.line(screen,ACCENT,(px+4,ly2),(px+w-4,ly2),1)
        txt("200",px+w-26,ly2-11,F_XS,ACCENT)
    txt(f"{len(ds.history)} eps | streak {ds.streak}",px+5,y0+h-13,F_XS,DIM)
    return y0+h+5

def draw_training_curve(y0, h=155):
    px=PANEL_X+10; w=PANEL_W-20
    txt("TRAINING CURVE  (300 K steps)", px, y0, F_XS, DIM); y0+=16
    rrect((px,y0,w,h),PANEL_BG,rad=6,a=220)
    border((px,y0,w,h),BORDER,rad=6)
    if not TRAIN_R:
        txt("No data",px+10,y0+h//2,F_SM,DIM); return y0+h+5
    pad=8; gx1=px+pad+28; gy1=y0+pad; gx2=px+w-pad; gy2=y0+h-pad-18
    gw=gx2-gx1; gh=gy2-gy1
    lo=min(TRAIN_R); hi=max(TRAIN_R); sp=hi-lo or 1
    def ts(i,v):
        return (gx1+int(i/max(len(TRAIN_R)-1,1)*gw),
                gy2-int((v-lo)/sp*gh))
    st=max(1,len(TRAIN_R)//350)
    rpts=[ts(i,TRAIN_R[i]) for i in range(0,len(TRAIN_R),st)]
    if len(rpts)>=2: pygame.draw.lines(screen,(80,90,130),False,rpts,1)
    spts=[ts(i,SMOOTH_R[i]) for i in range(0,len(SMOOTH_R),st)]
    if len(spts)>=2: pygame.draw.lines(screen,ACCENT,False,spts,2)
    y2l=gy2-int((200-lo)/sp*gh)
    if gy1<=y2l<=gy2:
        pygame.draw.line(screen,MINT,(gx1,y2l),(gx2,y2l),1)
        txt("200",gx1-28,y2l-6,F_XS,MINT)
    txt(f"{int(lo)}",gx1-26,gy2-6,F_XS,DIM)
    txt(f"{int(hi)}",gx1-26,gy1,F_XS,DIM)
    tot=TRAIN_T[-1] if TRAIN_T else 0
    txt("0",gx1,gy2+2,F_XS,DIM)
    txt(f"{tot//1000}K",gx2,gy2+2,F_XS,DIM,"topright")
    return y0+h+5

def draw_comparison(y0, h=128):
    px=PANEL_X+10; w=PANEL_W-20
    txt("MODEL COMPARISON  (mean ± std)", px, y0, F_XS, DIM); y0+=16
    rrect((px,y0,w,h),PANEL_BG,rad=6,a=220)
    border((px,y0,w,h),BORDER,rad=6)
    valid=[(n,EVAL[n]) for n in ALL_MODELS if EVAL.get(n)]
    if not valid:
        txt("No eval data",px+10,y0+h//2,F_SM,DIM); return y0+h+5
    means=[np.mean(s) for _,s in valid]; stds=[np.std(s) for _,s in valid]
    lo=min(min(means)-max(stds)-30,-80)
    hi=max(max(means)+max(stds)+20,320); sp=hi-lo or 1
    pad=8; gx1=px+pad+28; gx2=px+w-pad; gy_b=y0+h-22; gy_t=y0+8; gh=gy_b-gy_t
    cw=(gx2-gx1)//len(valid); bw=max(12,cw-12)
    for i,(name,sc) in enumerate(valid):
        mn,sd=np.mean(sc),np.std(sc); col=MODEL_COL[name]
        bx=gx1+i*cw+(cw-bw)//2; norm=(mn-lo)/sp
        bh=max(2,int(norm*gh)); by=gy_b-bh
        a=255 if name==ds.model else 140
        rrect((bx,by,bw,bh),col,rad=4,a=a)
        sdh=int(sd/sp*gh); mx=bx+bw//2
        pygame.draw.line(screen,WHITE,(mx,max(gy_t,by-sdh)),(mx,min(gy_b,by+sdh)),1)
        for cy3 in [max(gy_t,by-sdh),min(gy_b,by+sdh)]:
            pygame.draw.line(screen,WHITE,(mx-4,cy3),(mx+4,cy3),1)
        txt(f"{mn:.0f}",mx,by-13,F_XS,col,"midtop")
        txt(name[:4].upper(),mx,gy_b+2,F_XS,col,"midtop")
    y2l=gy_b-int((200-lo)/sp*gh)
    if gy_t<=y2l<=gy_b:
        pygame.draw.line(screen,MINT,(gx1,y2l),(gx2,y2l),1)
        txt("200",gx1-28,y2l-6,F_XS,MINT)
    return y0+h+5

def draw_footer():
    y=WIN_H-20
    pygame.draw.line(screen,BORDER,(PANEL_X+8,y-4),(WIN_W-8,y-4),1)
    txt("Q Quit   ← → Model   SPACE New Episode",PANEL_X+14,y,F_XS,DIM)

# ── Status flash overlay (crash/success) ─────────────────────────────────────
def draw_flash(t_now):
    age = t_now - ds.event_t
    if age > 1.5: return
    a = int(max(0, 180*(1-age/1.5)))
    col = RED if ds.crashed else MINT
    fs = pygame.Surface((ENV_W, ENV_H), pygame.SRCALPHA)
    pygame.draw.rect(fs, (*col, a), (0,0,ENV_W,ENV_H))
    screen.blit(fs, (0,0))
    if ds.crashed:
        txt("CRASH", ENV_W//2, ENV_H//2-20, F_XL, WHITE, "center")
    else:
        txt("LANDED!", ENV_W//2, ENV_H//2-20, F_XL, WHITE, "center")
    sc_col = MINT if ds.reward>=200 else (AMBER if ds.reward>=0 else RED)
    txt(f"Score: {ds.reward:+.1f}", ENV_W//2, ENV_H//2+20, F_LG, sc_col, "center")

# ── Model management ──────────────────────────────────────────────────────────
def load_model(name):
    p=f"models/ppo_{name}.zip"
    if not os.path.exists(p): return None
    return PPO.load(p)

cur_model = load_model(ds.model)
env = gym.make("LunarLander-v3")   # headless – we draw ourselves
obs, _ = env.reset(seed=100)
ds.obs = obs; ds.ep_start=time.time()

# ── Main loop ─────────────────────────────────────────────────────────────────
running=True; need_reset=False
print("Running. Q quit, ←→ model, SPACE new episode")
t_now=0.0

while running:
    dt = clock.tick(FPS)/1000.0
    t_now += dt

    for ev in pygame.event.get():
        if ev.type==pygame.QUIT: running=False
        elif ev.type==pygame.KEYDOWN:
            if ev.key in(pygame.K_q,pygame.K_ESCAPE): running=False
            elif ev.key==pygame.K_SPACE: need_reset=True
            elif ev.key==pygame.K_RIGHT:
                i=(ALL_MODELS.index(ds.model)+1)%len(ALL_MODELS)
                ds.model=ALL_MODELS[i]; cur_model=load_model(ds.model); need_reset=True
            elif ev.key==pygame.K_LEFT:
                i=(ALL_MODELS.index(ds.model)-1)%len(ALL_MODELS)
                ds.model=ALL_MODELS[i]; cur_model=load_model(ds.model); need_reset=True
        elif ev.type==pygame.MOUSEBUTTONDOWN:
            mx,my=pygame.mouse.get_pos()
            for br,name in ds.buttons:
                if br.collidepoint(mx,my) and name!=ds.model:
                    ds.model=name; cur_model=load_model(name); need_reset=True

    if need_reset:
        need_reset=False; ds.ep+=1; ds.step=0; ds.reward=0.0
        ds.ep_start=time.time(); ds.crashed=False; ds.landed=False
        obs,_=env.reset(seed=ds.ep+100); ds.obs=obs
        particles.clear()

    if cur_model is not None:
        action,_=cur_model.predict(obs,deterministic=True)
        obs,reward,terminated,truncated,info=env.step(action)
        ds.obs=obs; ds.action=int(action)
        ds.reward+=float(reward); ds.step+=1

        # Particles
        rx,ry=obs_to_px(obs[0],obs[1],obs[4])
        angle=obs[4]
        if action==2:
            emit_main_engine(rx,ry,angle,1.0)
        elif action==1:
            emit_side_engine(rx,ry,angle,-1)
        elif action==3:
            emit_side_engine(rx,ry,angle,1)

        if terminated or truncated:
            sc=ds.reward; ds.history.append(sc)
            if ds.best is None or sc>ds.best: ds.best=sc
            ds.streak = ds.streak+1 if sc>=200 else 0
            # detect crash vs land
            landed_ok = obs[6] and obs[7]  # both legs
            if sc>=100 and landed_ok:
                ds.landed=True; emit_success(rx,ry+FEET_OFFSET//2)
                emit_dust(rx,PAD_SURFACE_Y,2.0)
            else:
                ds.crashed=True; emit_explosion(rx,ry+FEET_OFFSET//2)
            ds.event_t=t_now
            print(f"Ep {ds.ep:4d} [{ds.model:8s}] score={sc:+8.2f} steps={ds.step} streak={ds.streak}")
            need_reset=True

    # Update particles
    particles[:] = [p for p in particles if p.update(dt)]

    # ── Draw ──────────────────────────────────────────────────────────────────
    draw_space_bg(t_now)
    draw_stars(t_now)
    draw_terrain()
    draw_pad(t_now)

    # Particles (below rocket)
    for p in particles: p.draw(screen)

    # Rocket
    rx,ry=obs_to_px(ds.obs[0],ds.obs[1],ds.obs[4])
    if not ds.crashed:
        draw_rocket(screen, rx, ry, ds.obs[4], ds.action,
                    bool(ds.obs[6]), bool(ds.obs[7]), t_now)

    # Altitude line (subtle)
    pad_y=PAD_SURFACE_Y
    feet_y=ry+FEET_OFFSET
    if feet_y < pad_y-2:
        pygame.draw.line(screen,(60,80,120,120),(rx,feet_y),(rx,pad_y),1)
        alt_m=max(0, pad_y-feet_y)
        txt(f"{alt_m}px",rx+6,feet_y+4,F_XS,DIM)

    # Trajectory ghost (last 30 steps of obs positions sampled live)
    # (skipped for clarity – position shown by current pos)

    # Flash overlay
    draw_flash(t_now)

    # Env pane border glow
    col_act=MODEL_COL[ds.model]
    pygame.draw.rect(screen,col_act,(0,0,ENV_W,ENV_H),2)

    # Panel
    draw_panel_bg()
    draw_header()
    draw_score_card(72)
    tb=draw_telemetry(152)
    sb=draw_model_selector(tb+4)
    hb=draw_history(sb,80)
    cb=draw_training_curve(hb,150)
    draw_comparison(cb,128)
    draw_footer()

    pygame.display.flip()

env.close(); pygame.quit(); print("Closed.")
