0  BEGIN PGM slots-2x-up MM 
1  BLK FORM 0.1 Z  X+0  Y-90  Z-10
2  BLK FORM 0.2  X+160  Y+0  Z+0
3  ;-------------------------------------
4  ;T12 D=+10 CR=+0 - ZMIN=-10 - flat end mill
5  ;-------------------------------------
6  TOOL CALL  Z ;SET TOOL AXIS FOR M140
7  L M140 MB MAX
8  ;-------------------------------------
9  * - 2D Contour8
10 TOOL CALL 12 Z S4043
11 L M140 MB MAX
12 M3
13 L  X+9  Y+8 R0 FMAX
14 L  Z+15 R0 FMAX
15 M8
16 CYCL DEF 32.0 TOLERANCE
17 CYCL DEF 32.1
18 L  Z+5 FMAX
19 L  Z-9 F183
20 CC  Y+7  Z-9
21 CP IPA-90 DR- F550
22 L  Y+6  Z-10
23 CC  X+10  Y+6
24 CP IPA+90 DR+
25 L  X+19.75  Y+5
26 CC  X+19.75  Y+0
27 CP IPA-90 DR-
28 L  X+24.75  Y-15
29 L  Y-17 F138
30 CC  X+25  Y-17
31 CP IPA+180 DR+
32 L  X+25.25  Y+0 F550
33 CC  X+30.25  Y+0
34 CP IPA-90 DR-
35 L  X+129.75  Y+5
36 CC  X+129.75  Y+0
37 CP IPA-90 DR-
38 L  X+134.75  Y-15
39 L  Y-17 F138
40 CC  X+135  Y-17
41 CP IPA+180 DR+
42 L  X+135.25  Y+0 F550
43 CC  X+140.25  Y+0
44 CP IPA-90 DR-
45 L  X+150  Y+5
46 CC  X+150  Y+6
47 CP IPA+90 DR+
48 L  X+151  Y+7
49 CC  Y+7  Z-9
50 CP IPA+90 DR+
51 L  Y+8  Z+15 FMAX
52 M9
53 M5
54 L M140 MB MAX
55 M30
56 END PGM slots-2x-up MM 
