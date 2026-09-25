// SIAT WS212-style pallet wrapper — adjustable reference model
// Units: millimetres
// Notes: Parametric visual/space-planning model, not a fabrication drawing.
// Adjust the values in USER PARAMETERS and press F5/F6 in OpenSCAD.

$fn = 72;

// ========================= USER PARAMETERS =========================
show_machine       = true;
show_pallet_load   = true;
show_film_web      = true;
show_safety_zone   = false;

// Turntable and base (WS212A drawing)
turntable_diameter = 1500;   // Ø 1500
turntable_height   = 73;     // drawing: platform height
turntable_edge     = 18;
base_length        = 2409;   // left of turntable → rear of machine
base_width         = 720;
base_height        = 73;     // frame flush with turntable (drawing: 73)

// Mast (WS212A drawing)
// Plan: Ø1500 + gap + 565 pedestal + 50 rear = 2409 overall
// Centre → mast face = 750 + (2409-1500-565-50) = 1044
mast_base_length   = 565;    // pedestal along machine axis
mast_rear_overhang = 50;     // rear of base beyond pedestal
mast_side_offset   = 35;     // side inset on mast assembly
mast_width         = 230;
mast_depth         = 260;
mast_height        = 2604;   // overall column height; AH models 3104
mast_wall          = 18;

// Film carriage
carriage_height    = 600;    // bottom above floor
carriage_width     = 330;
carriage_depth     = 300;
carriage_body_h    = 420;
film_roll_diameter = 240;
film_roll_height   = 500;
film_core_diameter = 76;

// Control box
control_box_width  = 260;
control_box_depth  = 170;
control_box_height = 420;
control_box_z      = 1280;

// Pallet/load shown on turntable
pallet_length      = 1200;
pallet_width       = 800;
pallet_height      = 145;
load_length        = 1120;
load_width         = 720;
load_height        = 1250;
load_z_gap         = 10;

// Film appearance
film_thickness     = 2;      // exaggerated for visibility
film_wrap_overlap  = 0.45;   // visual only, 0–0.8
film_tint          = [0.65, 0.82, 1.0, 0.22];

// Safety/clearance zone
safety_margin      = 650;
safety_zone_height = 12;

// Exploded view: 0 = assembled
explode            = 0;

// ========================= DERIVED VALUES ==========================
tt_r = turntable_diameter / 2;
floor_z = 0;
turntable_top = turntable_height;
pallet_bottom = turntable_top;
load_bottom = pallet_bottom + pallet_height + load_z_gap;
carriage_z = max(120, min(carriage_height, mast_height - carriage_body_h - 120));
// Mast column sits at the front of the 565 mm pedestal (facing the turntable)
mast_face_x = tt_r + (base_length - turntable_diameter - mast_base_length - mast_rear_overhang);
mast_x = mast_face_x + mast_width / 2;

// ========================= HELPERS ================================
module rounded_box(size=[100,100,100], r=8, center=false) {
    sx=size[0]; sy=size[1]; sz=size[2];
    translate(center ? [-sx/2,-sy/2,-sz/2] : [0,0,0])
        linear_extrude(height=sz)
            offset(r=r)
                offset(delta=-r)
                    square([sx,sy]);
}

module hollow_rect_tube(w,d,h,t) {
    difference() {
        rounded_box([w,d,h], min(12,t));
        translate([t,t,t])
            rounded_box([max(1,w-2*t), max(1,d-2*t), h], max(2,min(8,t/2)));
    }
}

module pallet(L=1200,W=800,H=145) {
    slat_h = H*0.18;
    block_h = H*0.58;
    slat_w = W/9;
    color([0.55,0.32,0.13]) {
        // top boards
        for (i=[0:6])
            translate([-L/2, -W/2 + i*(W-slat_w)/6, block_h+slat_h])
                cube([L, slat_w, slat_h]);
        // nine blocks
        for (x=[-L/2+80,0,L/2-160])
            for (y=[-W/2+55,0,W/2-110])
                translate([x,y,slat_h]) cube([160,110,block_h]);
        // bottom runners
        for (y=[-W/2+35,-55,W/2-105])
            translate([-L/2,y,0]) cube([L,70,slat_h]);
    }
}

module turntable() {
    // long floor/base beam extending toward mast
    color([0.12,0.16,0.19])
        translate([-tt_r, -base_width/2, 0])
            rounded_box([base_length, base_width, base_height], 18);

    // circular rotating platform (73 mm above floor per drawing)
    color([0.30,0.35,0.38])
        cylinder(d=turntable_diameter, h=turntable_height-turntable_edge);
    color([0.08,0.10,0.11])
        translate([0,0,turntable_height-turntable_edge])
            difference() {
                cylinder(d=turntable_diameter, h=turntable_edge);
                translate([0,0,-1]) cylinder(d=turntable_diameter-55, h=turntable_edge+2);
            }
    color([0.42,0.46,0.48])
        translate([0,0,turntable_height-turntable_edge])
            cylinder(d=turntable_diameter-55, h=turntable_edge);
}

module mast() {
    mx = mast_face_x;
    foot_y = max(mast_depth + 110, base_width);
    // mast foot — 565 mm pedestal, 35 mm side inset from drawing
    color([0.10,0.13,0.15])
        translate([mx, -foot_y/2 + mast_side_offset, base_height])
            rounded_box([mast_base_length, foot_y - mast_side_offset, 35], 10);

    // upright shell
    color([0.18,0.23,0.26])
        translate([mx,-mast_depth/2,base_height+35])
            hollow_rect_tube(mast_width,mast_depth,mast_height-base_height-70,mast_wall);

    // top cap (overall height 2604 from floor)
    color([0.08,0.10,0.11])
        translate([mx-10,-mast_depth/2-10,mast_height-35])
            rounded_box([mast_width+20,mast_depth+20,35],8);

    // carriage rail
    color([0.52,0.56,0.58])
        translate([mx-15,-mast_depth/2-12,base_height+120])
            cube([28,mast_depth+24,mast_height-base_height-260]);
}

module film_roll() {
    difference() {
        color([0.82,0.90,0.96,0.55]) cylinder(d=film_roll_diameter,h=film_roll_height);
        translate([0,0,-1]) cylinder(d=film_core_diameter,h=film_roll_height+2);
    }
}

module carriage() {
    mx = mast_x - mast_width/2;
    cz = base_height + carriage_z;
    // body projects toward turntable (negative X)
    color([0.10,0.14,0.16])
        translate([mx-carriage_width+45,-carriage_depth/2,cz])
            rounded_box([carriage_width,carriage_depth,carriage_body_h],16);

    // roll axis vertical, in front of carriage
    translate([mx-carriage_width-25,0,cz-(film_roll_height-carriage_body_h)/2]) {
        color([0.14,0.16,0.17]) translate([0,0,-22]) cylinder(d=55,h=film_roll_height+44);
        film_roll();
    }

    // guide rollers
    for (yy=[-carriage_depth*0.28,carriage_depth*0.28])
        color([0.70,0.73,0.75])
            translate([mx-carriage_width+22,yy,cz+40])
                cylinder(d=45,h=carriage_body_h-80);
}

module control_box() {
    bx = mast_x + mast_width/2 + 25;
    bz = base_height + control_box_z;
    color([0.85,0.88,0.89])
        translate([bx,-control_box_width/2,bz])
            rounded_box([control_box_depth,control_box_width,control_box_height],18);
    // dark front panel
    color([0.08,0.10,0.11])
        translate([bx-1,-control_box_width*0.38,bz+55])
            cube([5,control_box_width*0.76,control_box_height-100]);
    // screen and controls
    color([0.20,0.55,0.74])
        translate([bx-3,-75,bz+control_box_height-145]) cube([7,150,75]);
    color([0.95,0.15,0.10])
        translate([bx-7,-70,bz+75]) rotate([0,90,0]) cylinder(d=42,h=15);
    color([0.25,0.75,0.28])
        translate([bx-7,20,bz+75]) rotate([0,90,0]) cylinder(d=30,h=15);
}

module pallet_load() {
    translate([0,0,pallet_bottom + explode])
        pallet(pallet_length,pallet_width,pallet_height);
    color([0.72,0.57,0.37])
        translate([-load_length/2,-load_width/2,load_bottom + explode*1.5])
            rounded_box([load_length,load_width,load_height],8);
}

module film_web() {
    // Transparent wrapping skin around load; thickness is deliberately exaggerated.
    if (show_pallet_load) {
        color(film_tint)
            translate([-load_length/2-film_thickness,
                       -load_width/2-film_thickness,
                       load_bottom+25+explode*1.5])
                difference() {
                    rounded_box([load_length+2*film_thickness,
                                 load_width+2*film_thickness,
                                 max(10,load_height-50)],5);
                    translate([film_thickness,film_thickness,-1])
                        rounded_box([load_length,load_width,max(12,load_height-48)],4);
                }

        // film span from roll toward nearest side of load
        web_z = base_height + carriage_z + carriage_body_h*0.42;
        roll_x = mast_x-mast_width/2-carriage_width-25;
        load_x = load_length/2+film_thickness;
        color(film_tint)
            hull() {
                translate([roll_x,-film_thickness/2,web_z])
                    cube([2,film_thickness,film_roll_height*0.80]);
                translate([load_x,-film_thickness/2,web_z])
                    cube([2,film_thickness,film_roll_height*0.80]);
            }
    }
}

module safety_zone() {
    color([1.0,0.75,0.05,0.20])
        translate([0,0,safety_zone_height/2])
            difference() {
                cylinder(d=turntable_diameter+2*safety_margin,h=safety_zone_height,center=true);
                cylinder(d=turntable_diameter+40,h=safety_zone_height+2,center=true);
            }
}

// ========================= ASSEMBLY ===============================
if (show_machine) {
    turntable();
    translate([explode,0,0]) mast();
    translate([explode*1.7,0,explode*0.5]) carriage();
    translate([explode*1.4,0,explode]) control_box();
}

if (show_pallet_load) pallet_load();
if (show_film_web) film_web();
if (show_safety_zone) safety_zone();

// Ground reference
color([0.55,0.58,0.60,0.15])
    translate([-turntable_diameter/2-safety_margin,
               -turntable_diameter/2-safety_margin,
               -2])
        cube([turntable_diameter+2*safety_margin,
              turntable_diameter+2*safety_margin,2]);
