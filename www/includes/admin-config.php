<?php
/**
 * admin-config.php — Configuration constants for the admin panel
 */

declare(strict_types=1);

const MAIN_ADMIN_USERNAME = 'rennyrenren';

const MAIN_ROLES = ['CLUB ADVISER', 'OFFICER', 'COMMITTEE MEMBER', 'MEMBER'];

const SUB_ROLES_BY_MAIN = [
    'CLUB ADVISER'     => ['Faculty'],
    'OFFICER'          => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO/PRO'],
    'COMMITTEE MEMBER' => ['Sgt. at Arms', 'Media Tech 1', 'Media Tech 2', 'Media Tech 3', 'Media Tech 4'],
];

const CLUBS = [
    'Non-academic' => [
        'Dagitab', 'EBDA', 'Hiraya', 'Lyrico', 'Marahuyo',
        'Padayon', 'Pahina', 'Paraluman', 'PFG'
    ],
    'Academic' => [
        'Sibol', 'RISE', 'Dalumat', 'Numero', 'Kalakbay',
        'Le Verrier', 'Nexus', 'Aghimuan', 'Skill Speak'
    ]
];

const GRADES = ['G12', 'G11', 'JHS'];
const STRANDS = ['STEM', 'ABM/BE', 'HUMSS/ASSH', 'HE/HT', 'ICT/ICT Professionals', 'SPORTS'];
